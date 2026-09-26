import * as customers from '@/lib/server/domain/customers'
import * as dashboard from '@/lib/server/domain/dashboard'
import * as files from '@/lib/server/domain/files'
import * as packages from '@/lib/server/domain/packages'
import type { PackageInput } from '@/lib/contracts'
import { describe, expect, it } from 'vitest'
import { createSeededDb, emailsTo, tempPasswordIn } from '../helpers/db'
import * as auth from '@/lib/server/domain/auth'

const input = (over: Partial<PackageInput> = {}): PackageInput => ({
  title: 'Kit Dinossauro',
  slug: '',
  description: '  Rawr  ',
  coverUrl: null,
  priceCents: 3990,
  active: true,
  accessDays: 15,
  fileIds: ['fil_gen2', 'fil_uni1'],
  ...over,
})

describe('pacotes', () => {
  it('cria com slug automático e mantém a ordem dos arquivos; update reordena', async () => {
    const { db, admin } = await createSeededDb()
    const pkg = await packages.create(db, admin, input())
    expect(pkg).toMatchObject({ slug: 'kit-dinossauro', description: 'Rawr', fileIds: ['fil_gen2', 'fil_uni1'] })

    const updated = await packages.update(db, admin, pkg.id, input({ slug: 'kit-dinossauro', fileIds: ['fil_uni1', 'fil_gen2'] }))
    expect(updated.fileIds).toEqual(['fil_uni1', 'fil_gen2'])
    expect((await packages.getPublicBySlug(db, 'kit-dinossauro')).files.map((f) => f.filename)).toEqual(['topo-de-bolo.pdf', 'moldes-basicos.pdf'])
  })

  it('valida preço, slug duplicado, pacote ativo sem arquivos e arquivos inexistentes', async () => {
    const { db, admin } = await createSeededDb()
    await expect(packages.create(db, admin, input({ priceCents: 50, slug: 'kit-safari', fileIds: [] }))).rejects.toMatchObject({
      code: 'VALIDATION',
      details: { priceCents: expect.any(String), slug: expect.any(String), fileIds: expect.any(String) },
    })
    await expect(packages.create(db, admin, input({ fileIds: ['fil_nao_existe'] }))).rejects.toMatchObject({ details: { fileIds: expect.any(String) } })
  })

  it('exclui pacote sem vendas e bloqueia pacote com vendas', async () => {
    const { db, admin } = await createSeededDb()
    const pkg = await packages.create(db, admin, input())
    await packages.remove(db, admin, pkg.id)
    await expect(packages.get(db, admin, pkg.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(packages.remove(db, admin, 'pkg_safari')).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('lista com vendas e receita', async () => {
    const { db, admin } = await createSeededDb()
    const safari = (await packages.list(db, admin)).find((p) => p.id === 'pkg_safari')!
    // ord_1001 e ord_1009 aprovados (ord_1007 reembolsado, ord_1005 recusado não contam).
    expect(safari).toMatchObject({ salesCount: 2, revenueCents: 9980 })
  })
})

describe('arquivos', () => {
  it('registra upload com nome normalizado e recusa duplicado', async () => {
    const { db, admin } = await createSeededDb()
    const file = await files.registerUpload(db, admin, { folder: '/kits/safari/', filename: 'Painel Safári 60x90.pdf', size: 3_000_000, mime: 'application/pdf' })
    expect(file.key).toBe('kits/safari/painel-safari-60x90.pdf')
    await expect(files.registerUpload(db, admin, { folder: 'kits/safari', filename: 'topo-de-bolo.pdf', size: 1, mime: 'application/pdf' })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('arquivo usado em pacote só sai com force e é removido do pacote', async () => {
    const { db, admin } = await createSeededDb()
    await expect(files.remove(db, admin, 'fil_saf4')).rejects.toMatchObject({ code: 'CONFLICT' })
    await files.remove(db, admin, 'fil_saf4', { force: true })
    expect((await packages.get(db, admin, 'pkg_safari')).fileIds).not.toContain('fil_saf4')
  })

  it('lista pastas e só exclui pasta vazia', async () => {
    const { db, admin } = await createSeededDb()
    const root = await files.listFolder(db, admin, '')
    expect(root.folders.map((f) => f.name)).toEqual(['extras', 'kits'])
    await expect(files.removeFolder(db, admin, 'kits')).rejects.toMatchObject({ code: 'CONFLICT' })
    const created = await files.createFolder(db, admin, 'kits', 'Kit Dinossauro')
    expect(created).toBe('kits/kit-dinossauro')
    await files.removeFolder(db, admin, created)
  })
})

describe('clientes', () => {
  it('cadastro manual envia senha temporária que funciona; email duplicado é recusado', async () => {
    const { db, admin } = await createSeededDb()
    const rita = await customers.create(db, admin, { name: 'Rita Oliveira', email: 'Rita@Festinhas.test' })
    expect(rita).toMatchObject({ email: 'rita@festinhas.test', mustChangePassword: true })
    const [email] = await emailsTo(db, rita.email)
    await expect(auth.login(db, rita.email, tempPasswordIn(email.body)!)).resolves.toBeTruthy()
    await expect(customers.create(db, admin, { name: 'Outra', email: 'maria@festinhas.test' })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('reenviar acesso troca a senha e derruba as sessões', async () => {
    const { db, admin, maria, accounts } = await createSeededDb()
    const { token } = await auth.login(db, accounts.maria.email, accounts.maria.password)
    await customers.resendAccess(db, admin, maria.id)
    expect(await auth.validateSession(db, token)).toBeNull()
    await expect(auth.login(db, accounts.maria.email, accounts.maria.password)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('liberar kit manualmente aparece nos acessos do cliente', async () => {
    const { db, admin, maria } = await createSeededDb()
    await customers.grantAccess(db, admin, maria.id, 'pkg_futebol', null)
    const detail = await customers.get(db, admin, maria.id)
    expect(detail.entitlements.find((e) => e.packageId === 'pkg_futebol')).toMatchObject({ grantedBy: 'manual', status: 'active', expiresAt: null })
  })
})

describe('dashboard', () => {
  it('soma só pedidos aprovados do período', async () => {
    const { db, admin } = await createSeededDb()
    const s = await dashboard.stats(db, admin, 30)
    // Aprovados nos últimos 30 dias: ord_1002 (59,90), ord_1006 (39,90), ord_1009 (49,90), ord_1010 (59,90).
    expect(s).toMatchObject({ revenueCents: 20960, paidOrders: 4, pendingOrders: 1 })
    expect(s.daily).toHaveLength(30)
    expect(s.daily.reduce((sum, d) => sum + d.revenueCents, 0)).toBe(20960)
  })
})

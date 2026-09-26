import * as account from '@/lib/server/domain/account'
import * as customers from '@/lib/server/domain/customers'
import * as dashboard from '@/lib/server/domain/dashboard'
import * as files from '@/lib/server/domain/files'
import * as orders from '@/lib/server/domain/orders'
import * as packages from '@/lib/server/domain/packages'
import { describe, expect, it } from 'vitest'
import { createSeededDb } from '../helpers/db'

describe('permissões', () => {
  it('funções de admin recusam visitante e cliente', async () => {
    const { db, maria } = await createSeededDb()
    const adminCalls = [
      (a: typeof maria | null) => packages.list(db, a),
      (a: typeof maria | null) => orders.list(db, a),
      (a: typeof maria | null) => customers.list(db, a),
      (a: typeof maria | null) => files.listFolder(db, a, ''),
      (a: typeof maria | null) => dashboard.stats(db, a),
      (a: typeof maria | null) => customers.grantAccess(db, a, maria.id, 'pkg_futebol', null),
    ]
    for (const call of adminCalls) {
      await expect(call(null)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
      await expect(call(maria)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    }
  })

  it('área do cliente exige login de cliente', async () => {
    const { db, admin } = await createSeededDb()
    await expect(account.myKits(db, null)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(account.myKits(db, admin)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('downloads', () => {
  it('libera arquivo de kit ativo e registra o download', async () => {
    const { db, maria, admin } = await createSeededDb()
    const before = (await customers.get(db, admin, maria.id)).downloadsCount
    await expect(account.authorizeDownload(db, maria, 'fil_saf1')).resolves.toMatchObject({ key: 'kits/safari/topo-de-bolo.pdf' })
    expect((await customers.get(db, admin, maria.id)).downloadsCount).toBe(before + 1)
  })

  it('bloqueia kit vencido, arquivo de kit que não comprou e arquivo inexistente', async () => {
    const { db, maria } = await createSeededDb()
    await expect(account.authorizeDownload(db, maria, 'fil_pri3')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(account.authorizeDownload(db, maria, 'fil_fut1')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(account.authorizeDownload(db, maria, 'fil_nao_existe')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('arquivo compartilhado continua liberado se algum kit ativo o contém', async () => {
    const { db, maria } = await createSeededDb()
    // instrucoes-de-montagem está no Safári (ativo) e no Princesas (vencido).
    await expect(account.authorizeDownload(db, maria, 'fil_gen1')).resolves.toBeTruthy()
  })

  it('kit vencido não envia a lista de arquivos', async () => {
    const { db, maria } = await createSeededDb()
    const kit = await account.myKit(db, maria, 'pkg_princesas')
    expect(kit.status).toBe('expired')
    expect(kit.files).toEqual([])
  })

  it('revogar e restaurar acesso manualmente', async () => {
    const { db, admin, maria } = await createSeededDb()
    await customers.revokeAccess(db, admin, 'ent_1')
    await expect(account.authorizeDownload(db, maria, 'fil_saf1')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await customers.restoreAccess(db, admin, 'ent_1')
    await expect(account.authorizeDownload(db, maria, 'fil_saf1')).resolves.toBeTruthy()
  })
})

describe('catálogo público', () => {
  it('só mostra pacotes ativos e nunca expõe a key do bucket', async () => {
    const { db } = await createSeededDb()
    const list = await packages.listPublic(db)
    expect(list.map((p) => p.slug)).not.toContain('kit-unicornio')
    const safari = list.find((p) => p.slug === 'kit-safari')!
    expect(safari.files[0]).toEqual({ filename: 'topo-de-bolo.pdf', mime: 'application/pdf', size: 2_400_000 })
    expect(JSON.stringify(list)).not.toContain('kits/')
    await expect(packages.getPublicBySlug(db, 'kit-unicornio')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

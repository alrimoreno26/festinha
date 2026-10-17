import type { PackageInput } from '@/lib/contracts'
import * as account from '@/lib/server/domain/account'
import * as checkout from '@/lib/server/domain/checkout'
import { approveOrder } from '@/lib/server/domain/fulfillment'
import * as orders from '@/lib/server/domain/orders'
import * as packages from '@/lib/server/domain/packages'
import { toUser } from '@/lib/server/mappers'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createSeededDb, emailsTo, t } from '../helpers/db'

const buyer = { name: 'Beatriz Teste', email: 'beatriz@festinhas.test', phone: '(48) 99123-4567' }
const details = { childName: 'Miguel', age: '2 anos', theme: 'Fazendinha', colors: 'Azul', notes: 'Festa dia 20' }

const base = (over: Partial<PackageInput>): PackageInput => ({
  title: 'Lembrancinhas',
  slug: '',
  description: '',
  coverUrl: null,
  priceCents: 4200,
  active: true,
  accessDays: null,
  fileIds: [],
  kind: 'printed',
  items: [
    { name: 'Caixa Milk', quantity: 5 },
    { name: 'Caixa Cone', quantity: 5 },
  ],
  customizationLevel: 'none',
  ...over,
})

async function setup(over: Partial<PackageInput> = {}) {
  const seeded = await createSeededDb()
  const pkg = await packages.create(seeded.db, seeded.admin, base(over))
  return { ...seeded, pkg }
}

describe('pacotes sob encomenda', () => {
  it('impresso ativo exige a lista de itens, não arquivos, e sempre pede personalização', async () => {
    const { db, admin } = await createSeededDb()
    await expect(packages.create(db, admin, base({ items: [] }))).rejects.toMatchObject({ code: 'VALIDATION', details: { items: expect.any(String) } })
    const pkg = await packages.create(db, admin, base({ fileIds: ['fil_gen1'], accessDays: 30 }))
    // Arquivos e prazo de acesso não se aplicam a impressos.
    expect(pkg).toMatchObject({ kind: 'printed', fileIds: [], accessDays: null, customizationLevel: 'full' })
    expect(pkg.items).toHaveLength(2)
  })

  it('kit digital pronto continua exigindo arquivos para ficar ativo', async () => {
    const { db, admin } = await createSeededDb()
    await expect(packages.create(db, admin, base({ kind: 'digital', items: [] }))).rejects.toMatchObject({ details: { fileIds: expect.any(String) } })
  })
})

describe('checkout com personalização', () => {
  it('exige nome, tema e forma de recebimento no impresso', async () => {
    const { db, pkg } = await setup()
    await expect(checkout.createOrder(db, { packageSlug: pkg.slug, ...buyer })).rejects.toMatchObject({
      code: 'VALIDATION',
      details: { childName: expect.any(String), theme: expect.any(String), deliveryMethod: expect.any(String) },
    })
    await expect(
      checkout.createOrder(db, { packageSlug: pkg.slug, ...buyer, customization: details, deliveryMethod: 'delivery', deliveryAddress: '' }),
    ).rejects.toMatchObject({ details: { deliveryAddress: expect.any(String) } })
  })

  it('guarda a personalização e o endereço no pedido', async () => {
    const { db, pkg } = await setup()
    const { orderId } = await checkout.createOrder(db, {
      packageSlug: pkg.slug,
      ...buyer,
      customization: details,
      deliveryMethod: 'delivery',
      deliveryAddress: 'Rua das Flores, 10 - Ingleses',
    })
    const [order] = await db.select().from(t.orders).where(eq(t.orders.id, orderId))
    expect(order).toMatchObject({ customization: details, deliveryMethod: 'delivery', deliveryAddress: 'Rua das Flores, 10 - Ingleses', amountCents: 4200 })
  })

  it('tema individual pede só o tema (sem nome)', async () => {
    const { db, pkg } = await setup({ kind: 'custom_digital', title: 'Tema individual', customizationLevel: 'theme' })
    expect(pkg.customizationLevel).toBe('theme')
    await expect(checkout.createOrder(db, { packageSlug: pkg.slug, ...buyer })).rejects.toMatchObject({ details: { theme: expect.any(String) } })
    const { orderId } = await checkout.createOrder(db, { packageSlug: pkg.slug, ...buyer, customization: { theme: 'Safári' } })
    const [order] = await db.select().from(t.orders).where(eq(t.orders.id, orderId))
    expect(order.customization).toMatchObject({ theme: 'Safári', childName: '' })
  })

  it('kit digital pronto ignora personalização e entrega enviadas', async () => {
    const { db } = await createSeededDb()
    const { orderId } = await checkout.createOrder(db, { packageSlug: 'kit-safari', ...buyer, customization: details, deliveryMethod: 'delivery' })
    const [order] = await db.select().from(t.orders).where(eq(t.orders.id, orderId))
    expect(order).toMatchObject({ customization: null, deliveryMethod: 'download', deliveryAddress: null })
  })
})

describe('produção', () => {
  it('impresso aprovado entra em produção, sem acesso a arquivos, e avisa quando fica pronto', async () => {
    const { db, admin, pkg } = await setup()
    const { orderId } = await checkout.createOrder(db, { packageSlug: pkg.slug, ...buyer, customization: details, deliveryMethod: 'pickup' })
    await db.transaction((tx) => approveOrder(tx, orderId))

    const [order] = await db.select().from(t.orders).where(eq(t.orders.id, orderId))
    expect(order.productionStatus).toBe('in_production')
    expect(await db.select().from(t.entitlements).where(eq(t.entitlements.orderId, orderId))).toHaveLength(0)
    const [received] = await emailsTo(db, buyer.email)
    expect(received.subject).toContain('Recebemos seu pedido')
    expect(received.body).toContain('Tema: Fazendinha')

    await orders.updateProduction(db, admin, orderId, { status: 'ready' })
    const mails = await emailsTo(db, buyer.email)
    expect(mails.map((m) => m.subject)).toContain(`Seu ${pkg.title} está pronto! 🎉`)

    const detail = await orders.updateProduction(db, admin, orderId, { status: 'delivered' })
    expect(detail.order.productionStatus).toBe('delivered')
  })

  it('personalizado digital só é entregue com arquivo, e só o comprador baixa', async () => {
    const { db, admin, maria, pkg } = await setup({ kind: 'custom_digital', title: 'Personalizado digital' })
    const { orderId } = await checkout.createOrder(db, { packageSlug: pkg.slug, ...buyer, customization: details })
    await db.transaction((tx) => approveOrder(tx, orderId))

    await expect(orders.updateProduction(db, admin, orderId, { status: 'delivered' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(orders.updateProduction(db, admin, orderId, { status: 'ready' })).rejects.toMatchObject({ code: 'VALIDATION' })

    await orders.updateProduction(db, admin, orderId, { status: 'in_production', fileIds: ['fil_gen2'] })
    const [user] = await db.select().from(t.users).where(eq(t.users.email, buyer.email))
    const customer = toUser(user)
    // Antes de entregar, o arquivo não aparece nem pode ser baixado.
    expect((await account.myOrders(db, customer))[0].files).toHaveLength(0)
    await expect(account.authorizeDownload(db, customer, 'fil_gen2')).rejects.toMatchObject({ code: 'FORBIDDEN' })

    await orders.updateProduction(db, admin, orderId, { status: 'delivered' })
    expect((await account.myOrders(db, customer))[0].files.map((f) => f.id)).toEqual(['fil_gen2'])
    await expect(account.authorizeDownload(db, customer, 'fil_gen2')).resolves.toMatchObject({ id: 'fil_gen2' })
    expect((await emailsTo(db, buyer.email)).map((m) => m.subject)).toContain('Sua arte personalizada está pronta! 🎉')

    // Outro cliente não baixa o arquivo do pedido alheio (fil_gen2 também não está em nenhum kit da Maria).
    await expect(account.authorizeDownload(db, maria, 'fil_gen2')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('kit digital pronto não tem etapa de produção', async () => {
    const { db, admin } = await createSeededDb()
    await expect(orders.updateProduction(db, admin, 'ord_1001', { status: 'delivered' })).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

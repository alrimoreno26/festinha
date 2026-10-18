import type { PackageInput } from '@/lib/contracts'
import * as checkout from '@/lib/server/domain/checkout'
import { approveOrder } from '@/lib/server/domain/fulfillment'
import * as orders from '@/lib/server/domain/orders'
import * as packages from '@/lib/server/domain/packages'
import { attachUploads, cleanupStaleUploads, createUpload } from '@/lib/server/domain/uploads'
import { clearQuoteCache, type ShippingQuoter } from '@/lib/server/shipping'
import { demoStorage } from '@/lib/server/storage'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSeededDb, emailsTo, t } from '../helpers/db'

const buyer = { name: 'Loja Teste', email: 'loja@festinhas.test', phone: '(48) 99123-4567' }
const business = { businessName: 'Meu Pequeno Universo', cardText: '@meupequenouniverso', colors: 'Rosa e dourado' }

const cards = (over: Partial<PackageInput> = {}): PackageInput => ({
  title: 'Cartão de garantia',
  slug: '',
  description: '',
  coverUrl: null,
  priceCents: 100,
  active: true,
  accessDays: null,
  fileIds: [],
  kind: 'printed',
  items: [{ name: 'Cartão frente e verso', quantity: 1 }],
  customizationLevel: 'business',
  shippingBox: null,
  line: 'empresas',
  variants: [
    { id: '', label: '50 unidades', priceCents: 3990 },
    { id: '', label: '100 unidades', priceCents: 6990 },
  ],
  ...over,
})

async function setup(over: Partial<PackageInput> = {}) {
  const seeded = await createSeededDb()
  const pkg = await packages.create(seeded.db, seeded.admin, cards(over))
  return { ...seeded, pkg }
}

beforeEach(() => clearQuoteCache())

describe('pacote para empresas', () => {
  it('guarda linha e opções; o preço "a partir de" é o menor', async () => {
    const { pkg } = await setup()
    expect(pkg).toMatchObject({ line: 'empresas', customizationLevel: 'business', priceCents: 3990 })
    expect(pkg.variants.map((v) => v.label)).toEqual(['50 unidades', '100 unidades'])
    expect(pkg.variants.every((v) => v.id.startsWith('opt_'))).toBe(true)
  })

  it('recusa opção sem preço válido ou repetida', async () => {
    const { db, admin } = await createSeededDb()
    await expect(packages.create(db, admin, cards({ variants: [{ id: '', label: '50', priceCents: 0 }] }))).rejects.toMatchObject({
      details: { variants: expect.any(String) },
    })
    await expect(
      packages.create(db, admin, cards({ variants: [{ id: '', label: '50', priceCents: 500 }, { id: '', label: '50', priceCents: 900 }] })),
    ).rejects.toMatchObject({ details: { variants: expect.any(String) } })
  })
})

describe('checkout para empresas', () => {
  it('exige a marca e a quantidade; cobra o preço da opção escolhida', async () => {
    const { db, pkg } = await setup()
    await expect(checkout.createOrder(db, { packageSlug: pkg.slug, ...buyer, deliveryMethod: 'pickup' })).rejects.toMatchObject({
      details: { businessName: expect.any(String), variantId: expect.any(String) },
    })
    const cem = pkg.variants.find((v) => v.label === '100 unidades')!
    const { orderId } = await checkout.createOrder(db, {
      packageSlug: pkg.slug,
      ...buyer,
      customization: business,
      variantId: cem.id,
      deliveryMethod: 'pickup',
    })
    const [order] = await db.select().from(t.orders).where(eq(t.orders.id, orderId))
    expect(order.amountCents).toBe(6990)
    expect(order.variant).toEqual(cem)
    expect(order.customization).toMatchObject(business)
  })

  it('frete usa o preço da opção como valor declarado e soma ao total', async () => {
    const { db, pkg } = await setup({ shippingBox: { weightGrams: 250, heightCm: 4, widthCm: 11, lengthCm: 16 } })
    const calls: number[] = []
    const quoter: ShippingQuoter = {
      kind: 'melhorenvio',
      async quote(req) {
        calls.push(req.insuranceCents)
        return [{ serviceId: 1, service: 'PAC', company: 'Correios', priceCents: 1500, minDays: 3, maxDays: 5 }]
      },
    }
    const cem = pkg.variants[1]
    const address = { postalCode: '01310100', street: 'Av. Paulista', number: '1', complement: '', district: 'Bela Vista', city: 'São Paulo', state: 'SP' }
    const { orderId } = await checkout.createOrder(
      db,
      { packageSlug: pkg.slug, ...buyer, customization: business, variantId: cem.id, deliveryMethod: 'shipping', shippingAddress: address, shippingServiceId: 1 },
      null,
      undefined,
      quoter,
    )
    const [order] = await db.select().from(t.orders).where(eq(t.orders.id, orderId))
    expect(calls).toEqual([6990])
    expect(order.amountCents).toBe(6990 + 1500)
  })
})

describe('logo enviado pelo cliente', () => {
  afterEach(() => clearQuoteCache())

  it('aceita só imagem/PDF até 15 MB e limita envios por IP', async () => {
    const { db } = await createSeededDb()
    await expect(createUpload(db, { filename: 'virus.exe', size: 10, mime: 'application/x-msdownload' }, '1.1.1.1', demoStorage)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(createUpload(db, { filename: 'logo.png', size: 16 * 1024 * 1024, mime: 'image/png' }, '1.1.1.1', demoStorage)).rejects.toMatchObject({ code: 'VALIDATION' })
    for (let i = 0; i < 20; i++) await createUpload(db, { filename: `logo${i}.png`, size: 1000, mime: 'image/png' }, '2.2.2.2', demoStorage)
    await expect(createUpload(db, { filename: 'mais.png', size: 1000, mime: 'image/png' }, '2.2.2.2', demoStorage)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    // Outro IP não é afetado.
    await expect(createUpload(db, { filename: 'logo.png', size: 1000, mime: 'image/png' }, '3.3.3.3', demoStorage)).resolves.toMatchObject({ uploadUrl: null })
  })

  it('anexa o logo ao pedido com o token certo, uma vez só; o admin vê nos arquivos do cliente', async () => {
    const { db, admin, pkg } = await setup()
    const up = await createUpload(db, { filename: 'Logo Loja.png', size: 2048, mime: 'image/png' }, '1.1.1.1', demoStorage)

    // Token errado: recusado e o pedido não é criado.
    await expect(
      checkout.createOrder(db, { packageSlug: pkg.slug, ...buyer, customization: business, variantId: pkg.variants[0].id, deliveryMethod: 'pickup', uploads: [{ id: up.id, token: 'errado' }] }),
    ).rejects.toMatchObject({ details: { uploads: expect.any(String) } })
    expect(await db.select().from(t.orders).where(eq(t.orders.email, buyer.email))).toHaveLength(0)

    const { orderId } = await checkout.createOrder(db, {
      packageSlug: pkg.slug,
      ...buyer,
      customization: business,
      variantId: pkg.variants[0].id,
      deliveryMethod: 'pickup',
      uploads: [{ id: up.id, token: up.token }],
    })
    const detail = await orders.get(db, admin, orderId)
    expect(detail.customerFiles.map((f) => f.filename)).toEqual(['Logo Loja.png'])
    // Não conta como arquivo final do pedido.
    expect(detail.files).toHaveLength(0)

    // O mesmo upload não pode ir para outro pedido.
    await expect(db.transaction((tx) => attachUploads(tx, 'ord_1001', [{ id: up.id, token: up.token }], demoStorage))).rejects.toMatchObject({ code: 'VALIDATION' })

    // O aviso de pagamento menciona o arquivo e os dados da empresa.
    await db.transaction((tx) => approveOrder(tx, orderId))
    const [mail] = await emailsTo(db, buyer.email)
    expect(mail.body).toContain('Empresa/marca: Meu Pequeno Universo')
  })

  it('o cron apaga envios antigos que não viraram pedido', async () => {
    const { db } = await createSeededDb()
    const up = await createUpload(db, { filename: 'logo.png', size: 1000, mime: 'image/png' }, '1.1.1.1', demoStorage)
    expect(await cleanupStaleUploads(db, demoStorage)).toEqual({ removed: 0 })
    await db.update(t.customerUploads).set({ createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) }).where(eq(t.customerUploads.id, up.id))
    expect(await cleanupStaleUploads(db, demoStorage)).toEqual({ removed: 1 })
  })
})

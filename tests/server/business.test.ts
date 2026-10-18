import { perSheetVariant, PER_SHEET_ID, priceFor, type PackageInput } from '@/lib/contracts'
import * as checkout from '@/lib/server/domain/checkout'
import { approveOrder } from '@/lib/server/domain/fulfillment'
import * as orders from '@/lib/server/domain/orders'
import * as packages from '@/lib/server/domain/packages'
import { attachUploads, cleanupStaleUploads, createUpload } from '@/lib/server/domain/uploads'
import { clearQuoteCache, type ShippingQuoter } from '@/lib/server/shipping'
import { demoStorage } from '@/lib/server/storage'
import type { Db } from '@/lib/server/db/types'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSeededDb, emailsTo, t } from '../helpers/db'

const buyer = { name: 'Loja Teste', email: 'loja@festinhas.test', phone: '(48) 99123-4567' }
const SHEETS = { cardsPerSheet: 9, sheetPriceCents: 600, minUnitsForOptions: 50 }

const cards = (over: Partial<PackageInput> = {}): PackageInput => ({
  title: 'Impressão de cartões',
  slug: '',
  description: '',
  coverUrl: null,
  priceCents: 100,
  active: true,
  accessDays: null,
  fileIds: [],
  kind: 'printed',
  items: [{ name: 'Cartões impressos', quantity: 1 }],
  customizationLevel: 'business',
  shippingBox: null,
  line: 'empresas',
  sheetPricing: SHEETS,
  variants: [
    { id: '', label: '50 cartões', quantity: 50, priceCents: 3000 },
    { id: '', label: '100 cartões', quantity: 100, priceCents: 5500 },
  ],
  ...over,
})

async function setup(over: Partial<PackageInput> = {}) {
  const seeded = await createSeededDb()
  const pkg = await packages.create(seeded.db, seeded.admin, cards(over))
  return { ...seeded, pkg }
}

/** Design enviado pelo cliente (modo demo: não precisa subir de verdade). */
const design = async (db: Db, ip = '9.9.9.9') => {
  const up = await createUpload(db, { filename: 'cartao-frente.pdf', size: 4096, mime: 'application/pdf' }, ip, demoStorage)
  return [{ id: up.id, token: up.token }]
}

beforeEach(() => clearQuoteCache())

describe('preço por folha', () => {
  it('9 cartões por folha: arredonda para cima e cobra R$ 6,00 por folha', () => {
    expect(perSheetVariant(SHEETS, 1)).toMatchObject({ sheets: 1, priceCents: 600, quantity: 1 })
    expect(perSheetVariant(SHEETS, 9)).toMatchObject({ sheets: 1, priceCents: 600 })
    expect(perSheetVariant(SHEETS, 10)).toMatchObject({ sheets: 2, priceCents: 1200 })
    expect(perSheetVariant(SHEETS, 49)).toMatchObject({ sheets: 6, priceCents: 3600, label: '49 cartões (6 folhas A4)' })
  })

  it('quantidade avulsa só abaixo do mínimo; a partir dele valem as opções', () => {
    const pkg = { priceCents: 600, sheetPricing: SHEETS, variants: [{ id: 'opt_50', label: '50 cartões', quantity: 50, priceCents: 3000 }] }
    expect(priceFor(pkg, PER_SHEET_ID, 20).priceCents).toBe(1800)
    expect(priceFor(pkg, PER_SHEET_ID, 50).variant).toBeNull()
    expect(priceFor(pkg, PER_SHEET_ID, 0).variant).toBeNull()
    expect(priceFor(pkg, 'opt_50').variant).toMatchObject({ priceCents: 3000, sheets: 6 })
  })
})

describe('pacote de impressão de cartões', () => {
  it('guarda a cobrança por folha; o "a partir de" é o preço de uma folha', async () => {
    const { pkg } = await setup()
    expect(pkg).toMatchObject({ line: 'empresas', customizationLevel: 'business', sheetPricing: SHEETS, priceCents: 600 })
    expect(pkg.variants.every((v) => v.id.startsWith('opt_'))).toBe(true)
  })

  it('cada opção precisa da quantidade, a partir do mínimo', async () => {
    const { db, admin } = await createSeededDb()
    await expect(packages.create(db, admin, cards({ variants: [{ id: '', label: '30 cartões', quantity: 30, priceCents: 2000 }] }))).rejects.toMatchObject({
      details: { variants: expect.any(String) },
    })
    await expect(packages.create(db, admin, cards({ variants: [{ id: '', label: 'Pacote', priceCents: 2000 }] }))).rejects.toMatchObject({
      details: { variants: expect.any(String) },
    })
    await expect(packages.create(db, admin, cards({ sheetPricing: { cardsPerSheet: 0, sheetPriceCents: 600, minUnitsForOptions: 50 } }))).rejects.toMatchObject({
      details: { sheetPricing: expect.any(String) },
    })
  })
})

describe('checkout de impressão', () => {
  it('exige o design e a quantidade', async () => {
    const { db, pkg } = await setup()
    await expect(checkout.createOrder(db, { packageSlug: pkg.slug, ...buyer, deliveryMethod: 'pickup' })).rejects.toMatchObject({
      details: { uploads: expect.any(String), variantId: expect.any(String) },
    })
    await expect(
      checkout.createOrder(db, { packageSlug: pkg.slug, ...buyer, deliveryMethod: 'pickup', variantId: PER_SHEET_ID, quantity: 60, uploads: await design(db) }),
    ).rejects.toMatchObject({ details: { variantId: expect.stringContaining('1 a 49') } })
  })

  it('20 cartões avulsos = 3 folhas = R$ 18,00', async () => {
    const { db, pkg } = await setup()
    const { orderId } = await checkout.createOrder(db, {
      packageSlug: pkg.slug,
      ...buyer,
      deliveryMethod: 'pickup',
      variantId: PER_SHEET_ID,
      quantity: 20,
      uploads: await design(db),
    })
    const [order] = await db.select().from(t.orders).where(eq(t.orders.id, orderId))
    expect(order.amountCents).toBe(1800)
    expect(order.variant).toMatchObject({ id: PER_SHEET_ID, quantity: 20, sheets: 3 })
  })

  it('a partir de 50 cobra o preço da opção configurada; o frete usa esse valor', async () => {
    const { db, pkg } = await setup({ shippingBox: { weightGrams: 250, heightCm: 4, widthCm: 11, lengthCm: 16 } })
    const calls: number[] = []
    const quoter: ShippingQuoter = {
      kind: 'melhorenvio',
      async quote(req) {
        calls.push(req.insuranceCents)
        return [{ serviceId: 1, service: 'PAC', company: 'Correios', priceCents: 1500, minDays: 3, maxDays: 5 }]
      },
    }
    const cem = pkg.variants.find((v) => v.quantity === 100)!
    const address = { postalCode: '01310100', street: 'Av. Paulista', number: '1', complement: '', district: 'Bela Vista', city: 'São Paulo', state: 'SP' }
    const { orderId } = await checkout.createOrder(
      db,
      { packageSlug: pkg.slug, ...buyer, variantId: cem.id, deliveryMethod: 'shipping', shippingAddress: address, shippingServiceId: 1, uploads: await design(db) },
      null,
      undefined,
      quoter,
    )
    const [order] = await db.select().from(t.orders).where(eq(t.orders.id, orderId))
    expect(calls).toEqual([5500])
    expect(order.amountCents).toBe(5500 + 1500)
    expect(order.variant).toMatchObject({ quantity: 100, sheets: 12 })
  })
})

describe('arquivos enviados pelo cliente', () => {
  it('aceita só imagem/PDF até 15 MB e limita envios por IP', async () => {
    const { db } = await createSeededDb()
    await expect(createUpload(db, { filename: 'virus.exe', size: 10, mime: 'application/x-msdownload' }, '1.1.1.1', demoStorage)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(createUpload(db, { filename: 'logo.png', size: 16 * 1024 * 1024, mime: 'image/png' }, '1.1.1.1', demoStorage)).rejects.toMatchObject({ code: 'VALIDATION' })
    for (let i = 0; i < 20; i++) await createUpload(db, { filename: `logo${i}.png`, size: 1000, mime: 'image/png' }, '2.2.2.2', demoStorage)
    await expect(createUpload(db, { filename: 'mais.png', size: 1000, mime: 'image/png' }, '2.2.2.2', demoStorage)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    await expect(createUpload(db, { filename: 'logo.png', size: 1000, mime: 'image/png' }, '3.3.3.3', demoStorage)).resolves.toMatchObject({ uploadUrl: null })
  })

  it('liga o design ao pedido com o token certo, uma vez só; o admin vê nos arquivos do cliente', async () => {
    const { db, admin, pkg } = await setup()
    const up = await createUpload(db, { filename: 'Cartão frente.pdf', size: 2048, mime: 'application/pdf' }, '1.1.1.1', demoStorage)
    const base = { packageSlug: pkg.slug, ...buyer, variantId: PER_SHEET_ID, quantity: 9, deliveryMethod: 'pickup' as const }

    await expect(checkout.createOrder(db, { ...base, uploads: [{ id: up.id, token: 'errado' }] })).rejects.toMatchObject({ details: { uploads: expect.any(String) } })
    expect(await db.select().from(t.orders).where(eq(t.orders.email, buyer.email))).toHaveLength(0)

    const { orderId } = await checkout.createOrder(db, { ...base, customization: { businessName: 'Loja da Ana' }, uploads: [{ id: up.id, token: up.token }] })
    const detail = await orders.get(db, admin, orderId)
    expect(detail.customerFiles.map((f) => f.filename)).toEqual(['Cartão frente.pdf'])
    expect(detail.files).toHaveLength(0)

    await expect(db.transaction((tx) => attachUploads(tx, 'ord_1001', [{ id: up.id, token: up.token }], demoStorage))).rejects.toMatchObject({ code: 'VALIDATION' })

    await db.transaction((tx) => approveOrder(tx, orderId))
    const [mail] = await emailsTo(db, buyer.email)
    expect(mail.body).toContain('Empresa/marca: Loja da Ana')
  })

  it('o cron apaga envios antigos que não viraram pedido', async () => {
    const { db } = await createSeededDb()
    const up = await createUpload(db, { filename: 'logo.png', size: 1000, mime: 'image/png' }, '1.1.1.1', demoStorage)
    expect(await cleanupStaleUploads(db, demoStorage)).toEqual({ removed: 0 })
    await db.update(t.customerUploads).set({ createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) }).where(eq(t.customerUploads.id, up.id))
    expect(await cleanupStaleUploads(db, demoStorage)).toEqual({ removed: 1 })
  })
})

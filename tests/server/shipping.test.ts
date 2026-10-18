import type { PackageInput } from '@/lib/contracts'
import * as checkout from '@/lib/server/domain/checkout'
import { approveOrder } from '@/lib/server/domain/fulfillment'
import * as orders from '@/lib/server/domain/orders'
import * as packages from '@/lib/server/domain/packages'
import { quoteBySlug, resetShippingAlerts } from '@/lib/server/domain/shipping'
import { clearQuoteCache, parseQuotes, ShippingError, type ShippingQuoter } from '@/lib/server/shipping'
import type { ShippingChoice } from '@/lib/types'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSeededDb, emailsTo, t } from '../helpers/db'

const buyer = { name: 'Beatriz Teste', email: 'beatriz@festinhas.test', phone: '(48) 99123-4567' }
const details = { childName: 'Miguel', age: '2 anos', theme: 'Fazendinha', colors: '', notes: '' }
const address = { postalCode: '01310-100', street: 'Avenida Paulista', number: '1000', complement: 'Apto 52', district: 'Bela Vista', city: 'São Paulo', state: 'sp' }

const PAC: ShippingChoice = { serviceId: 1, service: 'PAC', company: 'Correios', priceCents: 1890, minDays: 5, maxDays: 7 }
const SEDEX: ShippingChoice = { serviceId: 2, service: 'SEDEX', company: 'Correios', priceCents: 3290, minDays: 1, maxDays: 2 }

/** Cotador falso: conta as chamadas e devolve as opções configuradas. */
function fakeQuoter(options: ShippingChoice[] | Error = [PAC, SEDEX]) {
  const calls: { toPostalCode: string; insuranceCents: number }[] = []
  const quoter: ShippingQuoter = {
    kind: 'melhorenvio',
    async quote(req) {
      calls.push({ toPostalCode: req.toPostalCode, insuranceCents: req.insuranceCents })
      if (options instanceof Error) throw options
      return options
    },
  }
  return { quoter, calls }
}

const printed = (over: Partial<PackageInput> = {}): PackageInput => ({
  title: 'Plaquinhas de mesa',
  slug: '',
  description: '',
  coverUrl: null,
  priceCents: 3400,
  active: true,
  accessDays: null,
  fileIds: [],
  kind: 'printed',
  items: [{ name: 'Plaquinha', quantity: 10 }],
  customizationLevel: 'full',
  shippingBox: { weightGrams: 300, heightCm: 5, widthCm: 20, lengthCm: 25 },
  line: 'festas',
  variants: [],
  sheetPricing: null,
  ...over,
})

async function setup(over: Partial<PackageInput> = {}) {
  const seeded = await createSeededDb()
  const pkg = await packages.create(seeded.db, seeded.admin, printed(over))
  return { ...seeded, pkg }
}

beforeEach(() => {
  clearQuoteCache()
  resetShippingAlerts()
})

describe('resposta do Melhor Envio', () => {
  it('usa custom_price/custom_delivery, ignora serviços com erro e ordena pelo preço', () => {
    const quotes = parseQuotes(
      [
        { id: 2, name: 'SEDEX', price: '40.00', custom_price: '32.90', custom_delivery_time: 2, custom_delivery_range: { min: 1, max: 2 }, company: { id: 1, name: 'Correios' } },
        { id: 1, name: 'PAC', price: '20.00', custom_price: '18.90', custom_delivery_time: 7, custom_delivery_range: { min: 5, max: 7 }, company: { id: 1, name: 'Correios' } },
        { id: 3, name: '.Package', error: 'Transportadora não atende este trecho.' },
      ],
      null,
    )
    expect(quotes).toEqual([PAC, SEDEX])
    // Filtro de serviços aceitos (MELHORENVIO_SERVICES).
    expect(parseQuotes([{ id: 1, name: 'PAC', custom_price: '18.90', custom_delivery_time: 7 }, { id: 2, name: 'SEDEX', custom_price: '32.90', custom_delivery_time: 2 }], [2])).toHaveLength(1)
  })
})

describe('cotação', () => {
  it('cota pelo CEP com o preço do kit como valor declarado, e reaproveita a cotação', async () => {
    const { db, pkg } = await setup()
    const { quoter, calls } = fakeQuoter()
    expect((await quoteBySlug(db, pkg.slug, '01310-100', quoter)).options).toEqual([PAC, SEDEX])
    await quoteBySlug(db, pkg.slug, '01310100', quoter)
    expect(calls).toEqual([{ toPostalCode: '01310100', insuranceCents: 3400 }])
  })

  it('recusa CEP inválido e pacote sem medidas', async () => {
    const { db, admin, pkg } = await setup()
    const { quoter } = fakeQuoter()
    await expect(quoteBySlug(db, pkg.slug, '123', quoter)).rejects.toMatchObject({ code: 'VALIDATION' })
    const semMedidas = await packages.create(db, admin, printed({ title: 'Tags', shippingBox: null }))
    await expect(quoteBySlug(db, semMedidas.slug, '01310100', quoter)).rejects.toMatchObject({ code: 'CONFLICT' })
    // No catálogo, o pacote sem medidas aparece sem envio.
    expect((await packages.getPublicBySlug(db, semMedidas.slug)).shippable).toBe(false)
  })

  it('token recusado: mensagem amigável ao cliente e um único aviso no Telegram', async () => {
    const env = { ...process.env }
    process.env.TELEGRAM_BOT_TOKEN = 'teste'
    process.env.TELEGRAM_CHAT_ID = '1'
    try {
      const { db, pkg } = await setup()
      const { quoter } = fakeQuoter(new ShippingError('Melhor Envio recusou o token (HTTP 401)', true))
      await expect(quoteBySlug(db, pkg.slug, '01310100', quoter)).rejects.toMatchObject({ code: 'NETWORK' })
      await expect(quoteBySlug(db, pkg.slug, '01310101', quoter)).rejects.toMatchObject({ code: 'NETWORK' })
      const alerts = await db.select().from(t.telegramOutbox)
      expect(alerts).toHaveLength(1)
      expect(alerts[0].text).toContain('Frete indisponível')
    } finally {
      process.env = env
    }
  })
})

describe('checkout com envio', () => {
  afterEach(() => clearQuoteCache())

  it('exige endereço completo e a opção de envio', async () => {
    const { db, pkg } = await setup()
    const { quoter } = fakeQuoter()
    await expect(
      checkout.createOrder(db, { packageSlug: pkg.slug, ...buyer, customization: details, deliveryMethod: 'shipping', shippingAddress: { postalCode: '01310100' } }, null, undefined, quoter),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      details: { street: expect.any(String), number: expect.any(String), district: expect.any(String), city: expect.any(String), state: expect.any(String), shippingServiceId: expect.any(String) },
    })
  })

  it('soma o frete recalculado no servidor ao total e guarda endereço e serviço', async () => {
    const { db, pkg } = await setup()
    const { quoter } = fakeQuoter()
    const { orderId } = await checkout.createOrder(
      db,
      { packageSlug: pkg.slug, ...buyer, customization: details, deliveryMethod: 'shipping', shippingAddress: address, shippingServiceId: 2 },
      null,
      undefined,
      quoter,
    )
    const [order] = await db.select().from(t.orders).where(eq(t.orders.id, orderId))
    expect(order.amountCents).toBe(3400 + 3290)
    expect(order.shipping).toEqual(SEDEX)
    expect(order.shippingAddress).toEqual({ ...address, postalCode: '01310100', state: 'SP' })
  })

  it('recusa serviço que não está na cotação (não confia no navegador)', async () => {
    const { db, pkg } = await setup()
    const { quoter } = fakeQuoter([PAC])
    await expect(
      checkout.createOrder(
        db,
        { packageSlug: pkg.slug, ...buyer, customization: details, deliveryMethod: 'shipping', shippingAddress: address, shippingServiceId: 2 },
        null,
        undefined,
        quoter,
      ),
    ).rejects.toMatchObject({ details: { shippingServiceId: expect.any(String) } })
  })

  it('despachar: guarda o rastreio e manda o email com o código', async () => {
    const { db, admin, pkg } = await setup()
    const { quoter } = fakeQuoter()
    const { orderId } = await checkout.createOrder(
      db,
      { packageSlug: pkg.slug, ...buyer, customization: details, deliveryMethod: 'shipping', shippingAddress: address, shippingServiceId: 1 },
      null,
      undefined,
      quoter,
    )
    await db.transaction((tx) => approveOrder(tx, orderId))
    const detail = await orders.updateProduction(db, admin, orderId, { status: 'ready', trackingCode: 'aa123456789br' })
    expect(detail.order).toMatchObject({ productionStatus: 'ready', trackingCode: 'AA123456789BR' })

    const mails = await emailsTo(db, buyer.email)
    const shipped = mails.find((m) => m.subject.includes('foi enviado'))
    expect(shipped?.body).toContain('AA123456789BR')
    expect(shipped?.actionUrl).toContain('melhorrastreio.com.br/rastreio/AA123456789BR')

    // Rastreio só vale para pedidos enviados.
    const pickup = await checkout.createOrder(db, { packageSlug: pkg.slug, ...buyer, customization: details, deliveryMethod: 'pickup' })
    await db.transaction((tx) => approveOrder(tx, pickup.orderId))
    await expect(orders.updateProduction(db, admin, pickup.orderId, { status: 'ready', trackingCode: 'X1' })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

import * as checkout from '@/lib/server/domain/checkout'
import * as orders from '@/lib/server/domain/orders'
import * as payments from '@/lib/server/domain/payments'
import { verifyMpSignature, type CheckoutRequest, type MpPayment, type PaymentGateway } from '@/lib/server/payments'
import { createHmac } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createSeededDb, emailsTo, t } from '../helpers/db'

/** Mercado Pago falso: guarda as preferências criadas e devolve os pagamentos que o teste definir. */
function fakeMp() {
  const preferences: CheckoutRequest[] = []
  const paymentsById = new Map<string, MpPayment>()
  const refunds: string[] = []
  let refundFails = false
  const gateway: PaymentGateway = {
    kind: 'mercadopago',
    createCheckout: async (req) => {
      preferences.push(req)
      return { preferenceId: `pref-${req.orderId}`, checkoutUrl: `https://mp.test/checkout/${req.orderId}` }
    },
    getPayment: async (id) => paymentsById.get(id) ?? null,
    findPaymentsForOrder: async (orderId) => [...paymentsById.values()].filter((p) => p.externalReference === orderId).reverse(),
    refund: async (id) => {
      if (refundFails) throw new Error('MP recusou')
      refunds.push(id)
    },
  }
  const pay = (id: string, orderId: string, status: string, amountCents: number, extra: Partial<MpPayment> = {}) => {
    const p: MpPayment = { id, status, statusDetail: null, externalReference: orderId, amountCents, currency: 'BRL', paymentTypeId: 'bank_transfer', dateCreated: null, ...extra }
    paymentsById.set(id, p)
    return p
  }
  return { gateway, preferences, refunds, pay, failRefunds: () => (refundFails = true) }
}

const buyer = { name: 'Beatriz Teste', email: 'beatriz@festinhas.test', phone: '(48) 99123-4567' }
const urls = { origin: 'https://festinhas.test', notificationUrl: 'https://festinhas.test/api/webhooks/mercadopago' }

async function newMpOrder(slug = 'kit-safari') {
  const ctx = await createSeededDb()
  const mp = fakeMp()
  const { orderId, checkoutUrl } = await checkout.createOrder(ctx.db, { packageSlug: slug, ...buyer }, urls, mp.gateway)
  return { ...ctx, mp, orderId, checkoutUrl }
}

const statusOf = async (db: Awaited<ReturnType<typeof createSeededDb>>['db'], id: string) =>
  (await db.select().from(t.orders).where(eq(t.orders.id, id)))[0]

describe('checkout com Mercado Pago', () => {
  it('cria a preferência com o preço do banco, retorno e webhook, e manda para o link do MP', async () => {
    const { db, mp, orderId, checkoutUrl } = await newMpOrder()
    expect(checkoutUrl).toBe(`https://mp.test/checkout/${orderId}`)
    expect(mp.preferences[0]).toMatchObject({
      orderId,
      amountCents: 4990,
      title: 'Kit Safári',
      returnUrl: `https://festinhas.test/checkout/retorno?pedido=${orderId}`,
      notificationUrl: 'https://festinhas.test/api/webhooks/mercadopago',
    })
    const order = await statusOf(db, orderId)
    expect(order).toMatchObject({ mpPreferenceId: `pref-${orderId}`, mpCheckoutUrl: checkoutUrl, status: 'pending' })
    const pub = await checkout.getOrder(db, orderId, {}, mp.gateway)
    expect(pub).toMatchObject({ provider: 'mercadopago', resumeUrl: checkoutUrl, pix: null })
  })

  it('o simulador não aceita pedidos do Mercado Pago', async () => {
    const { db, orderId } = await newMpOrder()
    await expect(checkout.simulatePayment(db, orderId, 'pix', { outcome: 'approved', pixAutoConfirmSeconds: 0 })).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('aplicar pagamento', () => {
  it('aprovado libera o acesso, grava o ID do MP e o método; repetir não duplica', async () => {
    const { db, mp, orderId } = await newMpOrder()
    const p = mp.pay('111', orderId, 'approved', 4990, { paymentTypeId: 'credit_card' })
    expect(await payments.applyPayment(db, p)).toEqual({ orderId, outcome: 'approved' })
    expect(await payments.applyPayment(db, p)).toEqual({ orderId, outcome: 'approved' })
    expect(await statusOf(db, orderId)).toMatchObject({ status: 'approved', mpPaymentId: '111', method: 'card', mpStatus: 'approved' })
    expect(await emailsTo(db, buyer.email)).toHaveLength(1)
  })

  it('valor diferente do pedido NÃO libera o acesso', async () => {
    const { db, mp, orderId } = await newMpOrder()
    const p = mp.pay('112', orderId, 'approved', 100)
    expect((await payments.applyPayment(db, p)).outcome).toBe('ignored')
    const order = await statusOf(db, orderId)
    expect(order.status).toBe('pending')
    expect(order.mpStatus).toContain('valor_divergente')
    expect(await db.select().from(t.users).where(eq(t.users.email, buyer.email))).toHaveLength(0)
  })

  it('outra moeda também não libera', async () => {
    const { db, mp, orderId } = await newMpOrder()
    expect((await payments.applyPayment(db, mp.pay('113', orderId, 'approved', 4990, { currency: 'USD' }))).outcome).toBe('ignored')
    expect((await statusOf(db, orderId)).status).toBe('pending')
  })

  it('recusado marca o pedido; depois um Pix aprovado ainda libera', async () => {
    const { db, mp, orderId } = await newMpOrder()
    await payments.applyPayment(db, mp.pay('120', orderId, 'rejected', 4990, { statusDetail: 'cc_rejected_insufficient_amount', paymentTypeId: 'credit_card' }))
    expect(await statusOf(db, orderId)).toMatchObject({ status: 'rejected', mpStatus: 'rejected/cc_rejected_insufficient_amount' })
    await payments.applyPayment(db, mp.pay('121', orderId, 'approved', 4990))
    expect(await statusOf(db, orderId)).toMatchObject({ status: 'approved', mpPaymentId: '121', method: 'pix' })
  })

  it('recusa de uma tentativa antiga não derruba um pedido já aprovado', async () => {
    const { db, mp, orderId } = await newMpOrder()
    await payments.applyPayment(db, mp.pay('130', orderId, 'approved', 4990))
    expect((await payments.applyPayment(db, mp.pay('131', orderId, 'rejected', 4990))).outcome).toBe('ignored')
    expect((await statusOf(db, orderId)).status).toBe('approved')
  })

  it('estorno e chargeback revogam o acesso', async () => {
    for (const status of ['refunded', 'charged_back'] as const) {
      const { db, mp, orderId, admin } = await newMpOrder()
      await payments.applyPayment(db, mp.pay('140', orderId, 'approved', 4990))
      await payments.applyPayment(db, mp.pay('140', orderId, status, 4990))
      const detail = await orders.get(db, admin, orderId)
      expect(detail.order.status).toBe(status)
      expect(detail.entitlement?.status).toBe('revoked')
    }
  })

  it('pagamento sem external_reference ou de pedido inexistente é ignorado', async () => {
    const { db, mp } = await newMpOrder()
    expect((await payments.applyPayment(db, mp.pay('150', 'ord_nao_existe', 'approved', 4990))).outcome).toBe('ignored')
    expect((await payments.applyPayment(db, { ...mp.pay('151', 'x', 'approved', 4990), externalReference: null })).outcome).toBe('ignored')
  })
})

describe('retorno do cliente', () => {
  it('com ?payment_id consulta o MP na hora e já mostra aprovado', async () => {
    const { db, mp, orderId } = await newMpOrder()
    mp.pay('160', orderId, 'approved', 4990)
    expect((await checkout.getOrder(db, orderId, { paymentId: '160' }, mp.gateway)).status).toBe('approved')
  })

  it('payment_id de OUTRO pedido não afeta este', async () => {
    const { db, mp, orderId } = await newMpOrder()
    const other = await checkout.createOrder(db, { packageSlug: 'kit-futebol', ...buyer }, urls, mp.gateway)
    mp.pay('161', other.orderId, 'approved', 3990)
    expect((await checkout.getOrder(db, orderId, { paymentId: '161' }, mp.gateway)).status).toBe('pending')
  })
})

describe('webhook', () => {
  const secret = 'segredo-de-teste'
  const sign = (dataId: string, requestId: string, ts = Date.now()) =>
    `ts=${ts},v1=${createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex')}`

  it('valida a assinatura (válida, adulterada, antiga, sem cabeçalho)', () => {
    expect(verifyMpSignature({ signature: sign('123', 'req-1'), requestId: 'req-1', dataId: '123', secret })).toBe(true)
    expect(verifyMpSignature({ signature: sign('123', 'req-1'), requestId: 'req-1', dataId: '999', secret })).toBe(false)
    expect(verifyMpSignature({ signature: sign('123', 'req-1'), requestId: 'req-1', dataId: '123', secret: 'outro' })).toBe(false)
    expect(verifyMpSignature({ signature: sign('123', 'req-1', Date.now() - 60 * 60 * 1000), requestId: 'req-1', dataId: '123', secret })).toBe(false)
    expect(verifyMpSignature({ signature: null, requestId: 'req-1', dataId: '123', secret })).toBe(false)
  })

  const paymentNotice = (id: string, requestId: string, signature: string | null) => ({
    signature,
    requestId,
    query: new URLSearchParams({ type: 'payment', 'data.id': id, 'x-vercel-protection-bypass': 'SEGREDO-DO-BYPASS' }),
    body: { type: 'payment', action: 'payment.updated', data: { id } },
  })

  it('aviso assinado aprova o pedido; o mesmo aviso de novo não reprocessa', async () => {
    const { db, mp, orderId } = await newMpOrder()
    mp.pay('170', orderId, 'approved', 4990)
    expect(await payments.handleMpWebhook(db, paymentNotice('170', 'req-b', sign('170', 'req-b')), { secret, gateway: mp.gateway })).toEqual({
      status: 200,
      result: `approved:${orderId}`,
    })
    expect((await statusOf(db, orderId)).status).toBe('approved')
    expect(await payments.handleMpWebhook(db, paymentNotice('170', 'req-b', sign('170', 'req-b')), { secret, gateway: mp.gateway })).toEqual({
      status: 200,
      result: 'duplicate',
    })
    const [event] = await db.select().from(t.webhookEvents).where(eq(t.webhookEvents.eventKey, 'req-b'))
    expect(event.processedAt).not.toBeNull()
    expect(event.payload).not.toContain('SEGREDO-DO-BYPASS')
  })

  it('aviso FALSO sem assinatura não aprova nada (o pagamento é sempre conferido na API do MP)', async () => {
    const { db, mp, orderId } = await newMpOrder()
    // O "atacante" inventa um pagamento aprovado; na API do MP ele não existe.
    const r = await payments.handleMpWebhook(db, paymentNotice('999', 'req-f', null), { secret, gateway: mp.gateway })
    expect(r.status).toBe(200)
    expect((await statusOf(db, orderId)).status).toBe('pending')
    // Um pagamento que existe mas está pendente também não libera nada.
    mp.pay('998', orderId, 'pending', 4990)
    await payments.handleMpWebhook(db, paymentNotice('998', 'req-g', 'ts=1,v1=00'), { secret, gateway: mp.gateway })
    expect((await statusOf(db, orderId)).status).toBe('pending')
  })

  it('aviso sem assinatura verificável de um pagamento aprovado de verdade é processado e marcado', async () => {
    const { db, mp, orderId } = await newMpOrder()
    mp.pay('171', orderId, 'approved', 4990)
    const r = await payments.handleMpWebhook(db, paymentNotice('171', 'req-u', null), { secret, gateway: mp.gateway })
    expect(r).toEqual({ status: 200, result: `approved:${orderId} (não verificado)` })
    expect((await statusOf(db, orderId)).status).toBe('approved')
    const [event] = await db.select().from(t.webhookEvents).where(eq(t.webhookEvents.eventKey, 'req-u'))
    expect(event.error).toBe('unverified_signature')
  })

  it('avisos não verificados repetidos do mesmo pagamento são limitados', async () => {
    const { db, mp, orderId } = await newMpOrder()
    let lookups = 0
    const getPayment = mp.gateway.getPayment
    mp.gateway.getPayment = async (id) => {
      lookups++
      return getPayment(id)
    }
    mp.pay('172', orderId, 'pending', 4990)
    await payments.handleMpWebhook(db, paymentNotice('172', 'req-1', null), { secret, gateway: mp.gateway })
    const second = await payments.handleMpWebhook(db, paymentNotice('172', 'req-2', null), { secret, gateway: mp.gateway })
    expect(second.result).toBe('throttled')
    expect(lookups).toBe(1)
  })

  it('tópicos que não são pagamento são aceitos e ignorados', async () => {
    const { db, mp } = await newMpOrder()
    const r = await payments.handleMpWebhook(
      db,
      { signature: sign('55', 'req-m'), requestId: 'req-m', query: new URLSearchParams({ type: 'merchant_order', 'data.id': '55' }), body: null },
      { secret, gateway: mp.gateway },
    )
    expect(r).toEqual({ status: 200, result: 'ignored_topic' })
  })

  it('erro ao consultar o MP sobe (→ 500, o MP tenta de novo) e fica registrado', async () => {
    const { db, mp, orderId } = await newMpOrder()
    mp.gateway.getPayment = async () => {
      throw new Error('MP fora do ar')
    }
    await expect(
      payments.handleMpWebhook(
        db,
        { signature: sign('180', 'req-e'), requestId: 'req-e', query: new URLSearchParams({ type: 'payment', 'data.id': '180' }), body: null },
        { secret, gateway: mp.gateway },
      ),
    ).rejects.toThrow('MP fora do ar')
    const [event] = await db.select().from(t.webhookEvents).where(eq(t.webhookEvents.eventKey, 'req-e'))
    expect(event).toMatchObject({ processedAt: null, error: 'MP fora do ar' })
    expect((await statusOf(db, orderId)).status).toBe('pending')
  })
})

describe('reembolso pelo admin', () => {
  it('pede o estorno ao MP e revoga o acesso', async () => {
    const { db, mp, orderId, admin } = await newMpOrder()
    await payments.applyPayment(db, mp.pay('190', orderId, 'approved', 4990))
    await orders.refund(db, admin, orderId, mp.gateway)
    expect(mp.refunds).toEqual(['190'])
    expect((await statusOf(db, orderId)).status).toBe('refunded')
  })

  it('se o MP recusar o estorno, nada muda', async () => {
    const { db, mp, orderId, admin } = await newMpOrder()
    await payments.applyPayment(db, mp.pay('191', orderId, 'approved', 4990))
    mp.failRefunds()
    await expect(orders.refund(db, admin, orderId, mp.gateway)).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await statusOf(db, orderId)).status).toBe('approved')
  })
})

describe('conciliação', () => {
  it('encontra no MP o pagamento de um pedido pendente cujo aviso não chegou', async () => {
    const { db, mp, orderId } = await newMpOrder()
    // Pedido criado "há 10 minutos" (a conciliação dá 2 min para o webhook chegar antes).
    await db.update(t.orders).set({ createdAt: new Date(Date.now() - 10 * 60 * 1000) }).where(eq(t.orders.id, orderId))
    mp.pay('200', orderId, 'approved', 4990)
    expect(await payments.reconcilePending(db, mp.gateway)).toMatchObject({ updated: 1 })
    expect((await statusOf(db, orderId)).status).toBe('approved')
  })
})

// Liga os pagamentos do Mercado Pago aos pedidos. Chamado pelo webhook, pela página de retorno
// e pela conciliação. Nunca confia no conteúdo do aviso: sempre consulta o pagamento na API do MP.

import { ServiceError } from '@/lib/services/errors'
import { and, eq, gte, lte } from 'drizzle-orm'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { requireAdmin, type Actor } from '../guards'
import { getPaymentGateway, verifyMpSignature, type MpPayment, type PaymentGateway } from '../payments'
import { approveOrder, reverseOrder } from './fulfillment'

type OrderRow = typeof t.orders.$inferSelect

const methodOf = (p: MpPayment) => (p.paymentTypeId === 'bank_transfer' ? 'pix' : 'card') as 'pix' | 'card'

export type PaymentOutcome = 'approved' | 'pending' | 'rejected' | 'refunded' | 'charged_back' | 'ignored'

/**
 * Aplica o estado de um pagamento do MP ao pedido (dentro de transação, com o pedido travado).
 * Idempotente: aplicar o mesmo pagamento de novo não muda nada.
 */
export async function applyPayment(db: Db, payment: MpPayment): Promise<{ orderId: string | null; outcome: PaymentOutcome }> {
  const orderId = payment.externalReference
  if (!orderId) return { orderId: null, outcome: 'ignored' }

  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(t.orders).where(eq(t.orders.id, orderId)).for('update')
    if (!order) return { orderId, outcome: 'ignored' as const }

    const mpStatus = payment.statusDetail ? `${payment.status}/${payment.statusDetail}` : payment.status
    // Um pedido pode ter várias tentativas (ex.: cartão recusado e depois Pix). Um pagamento que não é o
    // já registrado só pode mexer no pedido se ele ainda estiver pendente.
    const otherPayment = !!order.mpPaymentId && order.mpPaymentId !== payment.id
    const track = (extra: Partial<OrderRow> = {}) =>
      tx
        .update(t.orders)
        .set({ mpStatus, ...(otherPayment ? {} : { mpPaymentId: payment.id }), ...extra })
        .where(eq(t.orders.id, orderId))

    switch (payment.status) {
      case 'approved': {
        if (order.status === 'approved') return { orderId, outcome: 'approved' as const }
        if (order.status !== 'pending' && order.status !== 'rejected') return { orderId, outcome: 'ignored' as const }
        // O valor pago tem que ser exatamente o do pedido, em reais.
        if (payment.currency !== 'BRL' || payment.amountCents !== order.amountCents) {
          console.error('[pagamentos] valor divergente', { orderId, paymentId: payment.id, pago: payment.amountCents, pedido: order.amountCents, moeda: payment.currency })
          await tx.update(t.orders).set({ mpStatus: `valor_divergente/${payment.amountCents}${payment.currency}` }).where(eq(t.orders.id, orderId))
          return { orderId, outcome: 'ignored' as const }
        }
        await tx.update(t.orders).set({ mpStatus, mpPaymentId: payment.id, method: methodOf(payment), status: 'pending' }).where(eq(t.orders.id, orderId))
        await approveOrder(tx, orderId)
        return { orderId, outcome: 'approved' as const }
      }

      case 'pending':
      case 'in_process':
      case 'in_mediation':
      case 'authorized':
        if (order.status === 'pending') await track({ method: methodOf(payment) })
        return { orderId, outcome: 'pending' as const }

      case 'rejected':
      case 'cancelled':
        // Recusa só vale para pedido ainda pendente (o cliente pode ter pago com outro meio depois).
        if (order.status === 'pending' && !otherPayment) {
          await track({ status: 'rejected', method: methodOf(payment) })
          return { orderId, outcome: 'rejected' as const }
        }
        return { orderId, outcome: 'ignored' as const }

      case 'refunded':
      case 'charged_back': {
        if (order.status !== 'approved' || otherPayment) return { orderId, outcome: 'ignored' as const }
        await track()
        await reverseOrder(tx, orderId, payment.status)
        return { orderId, outcome: payment.status }
      }

      default:
        await track()
        return { orderId, outcome: 'ignored' as const }
    }
  })
}

/** Consulta um pagamento no MP e aplica ao pedido. */
export async function syncPayment(db: Db, paymentId: string, gateway: PaymentGateway = getPaymentGateway()) {
  const payment = await gateway.getPayment(paymentId)
  if (!payment) return { orderId: null, outcome: 'ignored' as const }
  return applyPayment(db, payment)
}

/** Procura no MP os pagamentos de um pedido e aplica o mais relevante (aprovado > pendente > o mais recente). */
export async function syncOrder(db: Db, orderId: string, gateway: PaymentGateway = getPaymentGateway()) {
  if (gateway.kind !== 'mercadopago') return { orderId, outcome: 'ignored' as const }
  const payments = await gateway.findPaymentsForOrder(orderId)
  if (!payments.length) return { orderId, outcome: 'ignored' as const }
  const rank = (p: MpPayment) =>
    ['approved', 'refunded', 'charged_back'].includes(p.status) ? 0 : ['pending', 'in_process', 'authorized'].includes(p.status) ? 1 : 2
  const best = [...payments].sort((a, b) => rank(a) - rank(b))[0]
  return applyPayment(db, best)
}

/** Admin: força a consulta de um pedido no MP (botão "Verificar no Mercado Pago"). */
export async function checkOrder(db: Db, actor: Actor, orderId: string, gateway: PaymentGateway = getPaymentGateway()) {
  requireAdmin(actor)
  if (gateway.kind !== 'mercadopago') throw new ServiceError('CONFLICT', 'Mercado Pago não configurado (modo simulador).')
  return syncOrder(db, orderId, gateway)
}

/**
 * Conciliação: revisa os pedidos pendentes recentes no MP, para o caso de algum aviso não ter chegado.
 * Chamada pelo cron e pelo botão do admin.
 */
export async function reconcilePending(db: Db, gateway: PaymentGateway = getPaymentGateway(), { maxAgeHours = 72 } = {}) {
  if (gateway.kind !== 'mercadopago') return { checked: 0, updated: 0 }
  const now = Date.now()
  const pending = await db
    .select({ id: t.orders.id })
    .from(t.orders)
    .where(
      and(
        eq(t.orders.status, 'pending'),
        gte(t.orders.createdAt, new Date(now - maxAgeHours * 60 * 60 * 1000)),
        // Dá um tempo para o próprio webhook chegar antes.
        lte(t.orders.createdAt, new Date(now - 2 * 60 * 1000)),
      ),
    )
  let updated = 0
  for (const { id } of pending) {
    try {
      const { outcome } = await syncOrder(db, id, gateway)
      if (outcome !== 'ignored' && outcome !== 'pending') updated++
    } catch (err) {
      console.error('[conciliação] falha ao consultar pedido', id, err)
    }
  }
  return { checked: pending.length, updated }
}

export async function reconcilePendingAsAdmin(db: Db, actor: Actor, gateway: PaymentGateway = getPaymentGateway()) {
  requireAdmin(actor)
  if (gateway.kind !== 'mercadopago') throw new ServiceError('CONFLICT', 'Mercado Pago não configurado (modo simulador).')
  return reconcilePending(db, gateway)
}

export interface WebhookInput {
  /** Cabeçalhos relevantes. */
  signature: string | null
  requestId: string | null
  /** Query string (?type=payment&data.id=123 ou o formato antigo ?topic=payment&id=123). */
  query: URLSearchParams
  /** Corpo JSON já lido (pode ser vazio). */
  body: Record<string, unknown> | null
}

/**
 * Processa um aviso do webhook. Devolve o status HTTP a responder:
 * 200 = processado ou ignorado de propósito; 401 = assinatura inválida; erros sobem (→ 500, o MP tenta de novo).
 */
export async function handleMpWebhook(db: Db, input: WebhookInput, { secret = process.env.MP_WEBHOOK_SECRET?.trim(), gateway = getPaymentGateway() } = {}) {
  const body = input.body ?? {}
  const data = (body.data as { id?: unknown } | undefined) ?? {}
  const topic = String(input.query.get('type') ?? input.query.get('topic') ?? body.type ?? body.topic ?? '')
  const dataId = String(input.query.get('data.id') ?? input.query.get('id') ?? data.id ?? '') || null

  if (secret && !verifyMpSignature({ signature: input.signature, requestId: input.requestId, dataId, secret })) {
    console.warn('[webhook] assinatura inválida', { topic, dataId })
    return { status: 401 as const, result: 'invalid_signature' }
  }
  if (!secret && process.env.VERCEL_ENV === 'production') {
    // Em produção a assinatura é obrigatória.
    throw new Error('MP_WEBHOOK_SECRET não configurado')
  }

  const eventKey = input.requestId ?? `${topic}:${dataId}:${String(body.action ?? '')}`
  const inserted = await db
    .insert(t.webhookEvents)
    .values({ provider: 'mercadopago', eventKey, topic, resourceId: dataId, payload: JSON.stringify({ query: input.query.toString(), body }) })
    .onConflictDoNothing()
    .returning({ id: t.webhookEvents.id })
  const event = inserted[0]
  if (!event) {
    // Mesmo aviso de novo: se já foi processado, não faz nada.
    const [prev] = await db
      .select()
      .from(t.webhookEvents)
      .where(and(eq(t.webhookEvents.provider, 'mercadopago'), eq(t.webhookEvents.eventKey, eventKey)))
    if (prev?.processedAt) return { status: 200 as const, result: 'duplicate' }
  }

  // Só nos interessam pagamentos (o MP também avisa sobre merchant_order, etc.).
  if (topic !== 'payment' || !dataId) {
    await db.update(t.webhookEvents).set({ processedAt: new Date() }).where(eq(t.webhookEvents.eventKey, eventKey))
    return { status: 200 as const, result: 'ignored_topic' }
  }

  try {
    const { orderId, outcome } = await syncPayment(db, dataId, gateway)
    await db
      .update(t.webhookEvents)
      .set({ processedAt: new Date(), error: null })
      .where(and(eq(t.webhookEvents.provider, 'mercadopago'), eq(t.webhookEvents.eventKey, eventKey)))
    return { status: 200 as const, result: `${outcome}${orderId ? `:${orderId}` : ''}` }
  } catch (err) {
    await db
      .update(t.webhookEvents)
      .set({ error: String((err as Error).message ?? err).slice(0, 500) })
      .where(and(eq(t.webhookEvents.provider, 'mercadopago'), eq(t.webhookEvents.eventKey, eventKey)))
    throw err
  }
}

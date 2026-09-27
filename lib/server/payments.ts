// Pagamentos. "mercadopago" (Checkout Pro) quando MP_ACCESS_TOKEN existe; senão "simulator"
// (a página /simulador-mp faz o papel do Mercado Pago, como na fase 1).

import { createHmac, timingSafeEqual } from 'node:crypto'
import { newId } from './ids'

const API = 'https://api.mercadopago.com'

/** Pagamento como o Mercado Pago informa (só os campos que usamos). */
export interface MpPayment {
  id: string
  status: string // approved | pending | in_process | in_mediation | authorized | rejected | cancelled | refunded | charged_back
  statusDetail: string | null
  externalReference: string | null
  amountCents: number
  currency: string
  paymentTypeId: string | null // bank_transfer (Pix) | credit_card | debit_card | ...
  dateCreated: string | null
}

export interface CheckoutRequest {
  orderId: string
  title: string
  packageId: string
  amountCents: number
  payer: { name: string; email: string }
  /** Para onde o MP devolve o cliente (sucesso, pendente ou falha). */
  returnUrl: string
  /** Para onde o MP envia os avisos de pagamento. */
  notificationUrl: string | null
}

export interface PaymentGateway {
  kind: 'mercadopago' | 'simulator'
  createCheckout(req: CheckoutRequest): Promise<{ preferenceId: string; checkoutUrl: string } | null>
  getPayment(paymentId: string): Promise<MpPayment | null>
  /** Pagamentos associados a um pedido (external_reference), do mais recente para o mais antigo. */
  findPaymentsForOrder(orderId: string): Promise<MpPayment[]>
  refund(paymentId: string): Promise<void>
}

class MpApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Mercado Pago respondeu ${status}: ${body.slice(0, 300)}`)
    this.name = 'MpApiError'
  }
}

function toPayment(p: Record<string, unknown>): MpPayment {
  return {
    id: String(p.id),
    status: String(p.status),
    statusDetail: (p.status_detail as string) ?? null,
    externalReference: (p.external_reference as string) ?? null,
    amountCents: Math.round(Number(p.transaction_amount) * 100),
    currency: String(p.currency_id ?? ''),
    paymentTypeId: (p.payment_type_id as string) ?? null,
    dateCreated: (p.date_created as string) ?? null,
  }
}

function mercadoPago(accessToken: string): PaymentGateway {
  async function call<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const res = await fetch(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    })
    const text = await res.text()
    if (!res.ok) throw new MpApiError(res.status, text)
    return (text ? JSON.parse(text) : null) as T
  }

  return {
    kind: 'mercadopago',
    async createCheckout(req) {
      const https = req.returnUrl.startsWith('https://')
      const pref = await call<{ id: string; init_point: string }>(
        'POST',
        '/checkout/preferences',
        {
          items: [
            {
              id: req.packageId,
              title: req.title,
              quantity: 1,
              unit_price: req.amountCents / 100,
              currency_id: 'BRL',
              category_id: 'others',
            },
          ],
          payer: { name: req.payer.name, email: req.payer.email },
          external_reference: req.orderId,
          metadata: { order_id: req.orderId },
          ...(req.notificationUrl ? { notification_url: req.notificationUrl } : {}),
          back_urls: { success: req.returnUrl, pending: req.returnUrl, failure: req.returnUrl },
          // O MP só aceita voltar sozinho para URLs https (em localhost o cliente clica em "Voltar").
          ...(https ? { auto_return: 'approved' } : {}),
          // Só Pix e cartão: sem boleto nem lotérica.
          payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }], installments: 12 },
          statement_descriptor: 'FESTINHAS',
          // O link de pagamento vale 24 h; depois o cliente gera outro ("Tentar novamente").
          expires: true,
          expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        `pref-${req.orderId}`,
      )
      return { preferenceId: pref.id, checkoutUrl: pref.init_point }
    },
    async getPayment(paymentId) {
      try {
        return toPayment(await call('GET', `/v1/payments/${encodeURIComponent(paymentId)}`))
      } catch (err) {
        if (err instanceof MpApiError && err.status === 404) return null
        throw err
      }
    },
    async findPaymentsForOrder(orderId) {
      const res = await call<{ results: Record<string, unknown>[] }>(
        'GET',
        `/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc&limit=10`,
      )
      return (res.results ?? []).map(toPayment)
    },
    async refund(paymentId) {
      await call('POST', `/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {}, newId('refund'))
    },
  }
}

export const simulatorGateway: PaymentGateway = {
  kind: 'simulator',
  createCheckout: async () => null,
  getPayment: async () => null,
  findPaymentsForOrder: async () => [],
  refund: async () => {},
}

let cached: PaymentGateway | null = null

export function getPaymentGateway(): PaymentGateway {
  if (cached) return cached
  const token = process.env.MP_ACCESS_TOKEN?.trim().replace(/^(["'])(.*)\1$/, '$2')
  cached = token ? mercadoPago(token) : simulatorGateway
  return cached
}

/**
 * Valida o cabeçalho x-signature do webhook do Mercado Pago.
 * Manifesto assinado: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (HMAC-SHA256 com a "assinatura secreta").
 */
export function verifyMpSignature({
  signature,
  requestId,
  dataId,
  secret,
  now = Date.now(),
  toleranceMs = 10 * 60 * 1000,
}: {
  signature: string | null
  requestId: string | null
  dataId: string | null
  secret: string
  now?: number
  toleranceMs?: number
}) {
  if (!signature || !dataId) return false
  const parts = Object.fromEntries(
    signature.split(',').map((kv) => {
      const [k, ...v] = kv.trim().split('=')
      return [k, v.join('=')]
    }),
  )
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false
  // O MP manda ts em milissegundos; recusa avisos muito antigos (replay).
  const tsMs = Number(ts) < 1e12 ? Number(ts) * 1000 : Number(ts)
  if (!Number.isFinite(tsMs) || Math.abs(now - tsMs) > toleranceMs) return false

  // IDs alfanuméricos vêm em minúsculas no manifesto.
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId
  let manifest = `id:${id};`
  if (requestId) manifest += `request-id:${requestId};`
  manifest += `ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(v1, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

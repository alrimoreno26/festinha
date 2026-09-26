// Fluxo público de compra. No backend real:
// createOrder → cria a preferência no Mercado Pago e devolve o `init_point`;
// a confirmação chega pelo webhook. Aqui a "página do Mercado Pago" é simulada.

import { mockCall } from '@/lib/mock/call'
import { getDevSettings } from '@/lib/mock/dev-settings'
import { approveOrder } from '@/lib/mock/fulfillment'
import { getDb, mutate, newId, type MockDB } from '@/lib/mock/store'
import type { OrderStatus, PaymentMethod } from '@/lib/types'
import { checkoutSchema, zodDetails, type CheckoutInput, type PublicOrder } from '@/lib/contracts'
import { ServiceError } from './errors'

export { checkoutSchema } from '@/lib/contracts'
export type { CheckoutInput, PublicOrder } from '@/lib/contracts'

const PIX_TTL_MS = 30 * 60 * 1000

/** Confirma sozinho os Pix pendentes cujo prazo simulado já passou. */
function settleAutoApprovals(db: MockDB) {
  const now = Date.now()
  let changed = false
  for (const order of db.orders) {
    if (order.status === 'pending' && order.autoApproveAt && new Date(order.autoApproveAt).getTime() <= now) {
      order.autoApproveAt = null
      approveOrder(db, order.id)
      changed = true
    }
  }
  return changed
}

function toPublicOrder(db: MockDB, orderId: string): PublicOrder {
  const order = db.orders.find((o) => o.id === orderId)
  if (!order) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
  const pkg = db.packages.find((p) => p.id === order.packageId)
  const user = db.users.find((u) => u.email === order.email)
  return {
    id: order.id,
    status: order.status,
    method: order.method,
    amountCents: order.amountCents,
    email: order.email,
    packageTitle: pkg?.title ?? 'Pacote',
    packageSlug: pkg?.slug ?? '',
    createdAt: order.createdAt,
    existingAccount: !!user && new Date(user.createdAt) < new Date(order.createdAt),
    pix:
      order.method === 'pix' && order.status === 'pending'
        ? {
            copyPaste: `00020126580014BR.GOV.BCB.PIX0136festinhas-${order.id}5204000053039865406${(order.amountCents / 100).toFixed(2)}5802BR`,
            expiresAt: new Date(new Date(order.createdAt).getTime() + PIX_TTL_MS).toISOString(),
          }
        : null,
  }
}

export const checkoutService = {
  /** Cria o pedido pendente. Retorna a URL do "Mercado Pago" (simulado). */
  createOrder: (input: CheckoutInput) =>
    mockCall(() => {
      const parsed = checkoutSchema.safeParse(input)
      if (!parsed.success) {
        throw new ServiceError('VALIDATION', 'Revise os campos destacados.', zodDetails(parsed.error))
      }
      return mutate((db) => {
        const pkg = db.packages.find((p) => p.slug === parsed.data.packageSlug && p.active)
        if (!pkg) throw new ServiceError('NOT_FOUND', 'Este pacote não está mais disponível.')
        const id = newId('ord')
        db.orders.push({
          id,
          userId: null,
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone,
          packageId: pkg.id,
          amountCents: pkg.priceCents,
          status: 'pending',
          method: 'pix',
          createdAt: new Date().toISOString(),
          paidAt: null,
        })
        return { orderId: id, checkoutUrl: `/simulador-mp/${id}` }
      })
    }),

  getOrder: (orderId: string) =>
    mockCall(() => {
      const db = getDb()
      const due = (o: MockDB['orders'][number]) => !!o.autoApproveAt && new Date(o.autoApproveAt).getTime() <= Date.now()
      // Só escreve quando há algo a confirmar — escrever sempre dispararia refetch em loop.
      if (db.orders.some((o) => o.id === orderId && due(o))) {
        return mutate((db) => {
          settleAutoApprovals(db)
          return toPublicOrder(db, orderId)
        })
      }
      return toPublicOrder(db, orderId)
    }),

  /**
   * Simula o pagamento na página do Mercado Pago. O resultado vem da DevToolbar:
   * aprovado, pendente (Pix aguardando) ou recusado.
   */
  pay: (orderId: string, method: PaymentMethod) =>
    mockCall(() =>
      mutate((db) => {
        const order = db.orders.find((o) => o.id === orderId)
        if (!order) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
        if (order.status !== 'pending') return { returnUrl: `/checkout/retorno?pedido=${orderId}` }

        const { paymentOutcome, pixAutoConfirmSeconds } = getDevSettings()
        order.method = method
        if (paymentOutcome === 'rejected') {
          order.status = 'rejected'
        } else if (paymentOutcome === 'pending' && method === 'pix') {
          order.autoApproveAt =
            pixAutoConfirmSeconds > 0 ? new Date(Date.now() + pixAutoConfirmSeconds * 1000).toISOString() : null
        } else {
          approveOrder(db, orderId)
        }
        return { returnUrl: `/checkout/retorno?pedido=${orderId}` }
      }),
    ),

  /** Tentar de novo após recusa: cria um novo pedido com os mesmos dados. */
  retry: (orderId: string) =>
    mockCall(() =>
      mutate((db) => {
        const old = db.orders.find((o) => o.id === orderId)
        if (!old) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
        const id = newId('ord')
        db.orders.push({ ...old, id, status: 'pending', createdAt: new Date().toISOString(), paidAt: null, autoApproveAt: null })
        return { orderId: id, checkoutUrl: `/simulador-mp/${id}` }
      }),
    ),
}

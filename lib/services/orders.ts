import { entitlementStatus } from '@/lib/entitlements'
import { mockCall } from '@/lib/mock/call'
import { approveOrder, reverseOrder } from '@/lib/mock/fulfillment'
import { publicUser, requireAdmin } from '@/lib/mock/session'
import { getDb, mutate } from '@/lib/mock/store'
import type { AdminOrderDetail, AdminOrderRow, OrderFilters } from '@/lib/contracts'
import { ServiceError } from './errors'

export type { AdminOrderDetail, AdminOrderRow, OrderFilters } from '@/lib/contracts'

export const ordersService = {
  list: (filters: OrderFilters = {}) =>
    mockCall<AdminOrderRow[]>(() => {
      const db = getDb()
      requireAdmin(db)
      const search = filters.search?.trim().toLowerCase()
      const since = filters.days ? Date.now() - filters.days * 24 * 60 * 60 * 1000 : 0
      return db.orders
        .filter((o) => !filters.status || filters.status === 'all' || o.status === filters.status)
        .filter((o) => !search || [o.id, o.name, o.email].some((v) => v.toLowerCase().includes(search)))
        .filter((o) => new Date(o.createdAt).getTime() >= since)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ autoApproveAt: _a, ...o }) => ({
          ...o,
          packageTitle: db.packages.find((p) => p.id === o.packageId)?.title ?? '—',
        }))
    }),

  get: (id: string) =>
    mockCall<AdminOrderDetail>(() => {
      const db = getDb()
      requireAdmin(db)
      const found = db.orders.find((o) => o.id === id)
      if (!found) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
      const { autoApproveAt: _a, ...order } = found
      const user = order.userId ? db.users.find((u) => u.id === order.userId) : undefined
      const ent = db.entitlements.find((e) => e.orderId === order.id)
      return {
        order,
        package: db.packages.find((p) => p.id === order.packageId) ?? null,
        customer: user ? publicUser(user) : null,
        entitlement: ent ? { ...ent, status: entitlementStatus(ent) } : null,
      }
    }),

  /** Confirma manualmente um pagamento pendente (equivale a receber o webhook "approved"). */
  approve: (id: string) =>
    mockCall(() =>
      mutate((db) => {
        requireAdmin(db)
        const order = db.orders.find((o) => o.id === id)
        if (!order) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
        if (order.status !== 'pending') throw new ServiceError('CONFLICT', 'Só pedidos pendentes podem ser aprovados.')
        order.autoApproveAt = null
        approveOrder(db, id)
      }),
    ),

  /** Reembolso (no real: POST /v1/payments/{id}/refunds). Revoga o acesso. */
  refund: (id: string) =>
    mockCall(() =>
      mutate((db) => {
        requireAdmin(db)
        const order = db.orders.find((o) => o.id === id)
        if (!order) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
        if (order.status !== 'approved') throw new ServiceError('CONFLICT', 'Só pedidos aprovados podem ser reembolsados.')
        reverseOrder(db, id, 'refunded')
      }),
    ),

  /** Só para a DevToolbar: simula um webhook de chargeback. */
  simulateChargeback: (id: string) =>
    mockCall(() =>
      mutate((db) => {
        const order = db.orders.find((o) => o.id === id)
        if (order?.status === 'approved') reverseOrder(db, id, 'charged_back')
      }),
    ),
}

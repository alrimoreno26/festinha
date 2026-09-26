import type { AdminOrderDetail, AdminOrderRow, OrderFilters } from '@/lib/contracts'
import { api, qs } from './http'

export type { AdminOrderDetail, AdminOrderRow, OrderFilters } from '@/lib/contracts'

export const ordersService = {
  list: (filters: OrderFilters = {}) =>
    api<AdminOrderRow[]>(
      'GET',
      `/api/admin/orders${qs({ status: filters.status === 'all' ? undefined : filters.status, q: filters.search, dias: filters.days })}`,
    ),

  get: (id: string) => api<AdminOrderDetail>('GET', `/api/admin/orders/${id}`),

  /** Confirma manualmente um pagamento pendente (equivale a receber o webhook "approved"). */
  approve: (id: string) => api<null>('POST', `/api/admin/orders/${id}/approve`),

  /** Reembolso. Revoga o acesso. */
  refund: (id: string) => api<null>('POST', `/api/admin/orders/${id}/refund`),

  /** Só no modo de simulação: equivale ao webhook de chargeback. */
  simulateChargeback: (id: string) => api<null>('POST', `/api/dev/orders/${id}/chargeback`),
}

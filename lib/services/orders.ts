import type { AdminOrderDetail, AdminOrderRow, OrderFilters } from '@/lib/contracts'
import type { ProductionStatus } from '@/lib/types'
import { api, qs } from './http'

export type { AdminOrderDetail, AdminOrderRow, OrderFilters } from '@/lib/contracts'

export const ordersService = {
  list: (filters: OrderFilters = {}) =>
    api<AdminOrderRow[]>(
      'GET',
      `/api/admin/orders${qs({
        status: filters.status === 'all' ? undefined : filters.status,
        q: filters.search,
        dias: filters.days,
        producao: filters.toProduce ? 1 : undefined,
      })}`,
    ),

  get: (id: string) => api<AdminOrderDetail>('GET', `/api/admin/orders/${id}`),

  /** Confirma manualmente um pagamento pendente (equivale a receber o webhook "approved"). */
  approve: (id: string) => api<null>('POST', `/api/admin/orders/${id}/approve`),

  /** Reembolso. Revoga o acesso. */
  refund: (id: string) => api<null>('POST', `/api/admin/orders/${id}/refund`),

  /** Consulta os pagamentos do pedido no Mercado Pago e aplica o estado atual. */
  checkPayment: (id: string) => api<{ outcome: string }>('POST', `/api/admin/orders/${id}/check`),

  /** Revisa no Mercado Pago todos os pedidos pendentes recentes. */
  reconcilePending: () => api<{ checked: number; updated: number }>('POST', '/api/admin/orders/reconcile'),

  /** Avança a produção (sob encomenda). `fileIds`: arquivos finais já enviados ao bucket (personalizado digital). */
  updateProduction: (id: string, status: ProductionStatus, fileIds?: string[], trackingCode?: string) =>
    api<AdminOrderDetail>('PATCH', `/api/admin/orders/${id}/production`, { status, fileIds, trackingCode }),

  /** URL assinada para baixar um arquivo (ex.: logo enviado pelo cliente). */
  downloadFile: (fileId: string) => api<{ url: string; filename: string }>('POST', `/api/admin/files/${fileId}/download`),

  /** Tira um arquivo do pedido. */
  detachFile: (id: string, fileId: string) => api<AdminOrderDetail>('DELETE', `/api/admin/orders/${id}/files/${fileId}`),

  /** Só no modo de simulação: equivale ao webhook de chargeback. */
  simulateChargeback: (id: string) => api<null>('POST', `/api/dev/orders/${id}/chargeback`),
}

import type { CustomerDetail, CustomerRow, newCustomerSchema } from '@/lib/contracts'
import type { User } from '@/lib/types'
import type { z } from 'zod'
import { api, qs } from './http'

export { newCustomerSchema } from '@/lib/contracts'
export type { CustomerDetail, CustomerEntitlement, CustomerRow } from '@/lib/contracts'

export const customersService = {
  list: (search = '') => api<CustomerRow[]>('GET', `/api/admin/customers${qs({ q: search.trim() })}`),

  get: (id: string) => api<CustomerDetail>('GET', `/api/admin/customers/${id}`),

  /** Cadastro manual (ex.: venda feita pelo WhatsApp). O servidor envia a senha temporária por email. */
  create: (input: z.input<typeof newCustomerSchema>) => api<User>('POST', '/api/admin/customers', input),

  grantAccess: (userId: string, packageId: string, accessDays: number | null) =>
    api<null>('POST', `/api/admin/customers/${userId}/grant`, { packageId, accessDays }),

  revokeAccess: (entitlementId: string) => api<null>('POST', `/api/admin/entitlements/${entitlementId}/revoke`),

  restoreAccess: (entitlementId: string) => api<null>('POST', `/api/admin/entitlements/${entitlementId}/restore`),

  /** Gera nova senha temporária e reenvia o email de acesso. */
  resendAccess: (userId: string) => api<null>('POST', `/api/admin/customers/${userId}/resend`),
}

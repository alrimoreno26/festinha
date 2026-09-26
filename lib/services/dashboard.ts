import type { DashboardStats } from '@/lib/contracts'
import { api } from './http'

export type { DashboardStats } from '@/lib/contracts'

export const dashboardService = {
  stats: (periodDays = 30) => api<DashboardStats>('GET', `/api/admin/dashboard?dias=${periodDays}`),
}

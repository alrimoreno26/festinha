import { mockCall } from '@/lib/mock/call'
import { requireAdmin } from '@/lib/mock/session'
import { getDb } from '@/lib/mock/store'
import type { OrderStatus } from '@/lib/types'

export interface DashboardStats {
  periodDays: number
  revenueCents: number
  previousRevenueCents: number
  paidOrders: number
  pendingOrders: number
  newCustomers: number
  byStatus: Record<OrderStatus, number>
  /** Receita por dia (mais antigo → mais recente). */
  daily: { date: string; revenueCents: number; orders: number }[]
  topPackages: { id: string; title: string; sales: number; revenueCents: number }[]
}

const DAY = 24 * 60 * 60 * 1000

export const dashboardService = {
  stats: (periodDays = 30) =>
    mockCall<DashboardStats>(() => {
      const db = getDb()
      requireAdmin(db)
      const now = Date.now()
      const start = now - periodDays * DAY
      const prevStart = start - periodDays * DAY
      const inRange = (iso: string | null, from: number, to: number) => !!iso && new Date(iso).getTime() >= from && new Date(iso).getTime() < to

      const paid = db.orders.filter((o) => o.status === 'approved' && inRange(o.paidAt, start, now + 1))
      const prevPaid = db.orders.filter((o) => o.status === 'approved' && inRange(o.paidAt, prevStart, start))

      const byStatus: Record<OrderStatus, number> = { pending: 0, approved: 0, rejected: 0, refunded: 0, charged_back: 0 }
      db.orders.filter((o) => inRange(o.createdAt, start, now + 1)).forEach((o) => byStatus[o.status]++)

      const daily = Array.from({ length: periodDays }, (_, i) => {
        const dayStart = new Date(now - (periodDays - 1 - i) * DAY)
        dayStart.setHours(0, 0, 0, 0)
        const from = dayStart.getTime()
        const dayOrders = paid.filter((o) => inRange(o.paidAt, from, from + DAY))
        return {
          date: dayStart.toISOString(),
          revenueCents: dayOrders.reduce((s, o) => s + o.amountCents, 0),
          orders: dayOrders.length,
        }
      })

      const top = new Map<string, { sales: number; revenueCents: number }>()
      paid.forEach((o) => {
        const cur = top.get(o.packageId) ?? { sales: 0, revenueCents: 0 }
        top.set(o.packageId, { sales: cur.sales + 1, revenueCents: cur.revenueCents + o.amountCents })
      })

      return {
        periodDays,
        revenueCents: paid.reduce((s, o) => s + o.amountCents, 0),
        previousRevenueCents: prevPaid.reduce((s, o) => s + o.amountCents, 0),
        paidOrders: paid.length,
        pendingOrders: db.orders.filter((o) => o.status === 'pending').length,
        newCustomers: db.users.filter((u) => u.role === 'customer' && inRange(u.createdAt, start, now + 1)).length,
        byStatus,
        daily,
        topPackages: [...top.entries()]
          .map(([id, v]) => ({ id, title: db.packages.find((p) => p.id === id)?.title ?? '—', ...v }))
          .sort((a, b) => b.revenueCents - a.revenueCents)
          .slice(0, 5),
      }
    }),
}

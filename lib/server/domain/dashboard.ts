import type { DashboardStats } from '@/lib/contracts'
import type { OrderStatus } from '@/lib/types'
import { and, eq, gte, sql } from 'drizzle-orm'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { requireAdmin, type Actor } from '../guards'

const DAY = 24 * 60 * 60 * 1000

export async function stats(db: Db, actor: Actor, periodDays = 30): Promise<DashboardStats> {
  requireAdmin(actor)
  const now = Date.now()
  const start = new Date(now - periodDays * DAY)
  const prevStart = new Date(now - 2 * periodDays * DAY)

  const [paid, byStatusRows, [{ pending }], [{ newCustomers }]] = await Promise.all([
    // Pedidos pagos do período atual + anterior (para a comparação).
    db
      .select({ packageId: t.orders.packageId, title: t.packages.title, amountCents: t.orders.amountCents, paidAt: t.orders.paidAt })
      .from(t.orders)
      .leftJoin(t.packages, eq(t.orders.packageId, t.packages.id))
      .where(and(eq(t.orders.status, 'approved'), gte(t.orders.paidAt, prevStart))),
    db
      .select({ status: t.orders.status, n: sql<number>`count(*)::int` })
      .from(t.orders)
      .where(gte(t.orders.createdAt, start))
      .groupBy(t.orders.status),
    db.select({ pending: sql<number>`count(*)::int` }).from(t.orders).where(eq(t.orders.status, 'pending')),
    db
      .select({ newCustomers: sql<number>`count(*)::int` })
      .from(t.users)
      .where(and(eq(t.users.role, 'customer'), gte(t.users.createdAt, start))),
  ])

  const current = paid.filter((o) => o.paidAt! >= start)
  const previous = paid.filter((o) => o.paidAt! < start)

  const byStatus: Record<OrderStatus, number> = { pending: 0, approved: 0, rejected: 0, refunded: 0, charged_back: 0 }
  byStatusRows.forEach((r) => (byStatus[r.status] = r.n))

  const daily = Array.from({ length: periodDays }, (_, i) => {
    const day = new Date(now - (periodDays - 1 - i) * DAY)
    day.setHours(0, 0, 0, 0)
    const from = day.getTime()
    const orders = current.filter((o) => o.paidAt!.getTime() >= from && o.paidAt!.getTime() < from + DAY)
    return { date: day.toISOString(), revenueCents: orders.reduce((s, o) => s + o.amountCents, 0), orders: orders.length }
  })

  const top = new Map<string, { title: string; sales: number; revenueCents: number }>()
  current.forEach((o) => {
    const cur = top.get(o.packageId) ?? { title: o.title ?? '—', sales: 0, revenueCents: 0 }
    top.set(o.packageId, { ...cur, sales: cur.sales + 1, revenueCents: cur.revenueCents + o.amountCents })
  })

  return {
    periodDays,
    revenueCents: current.reduce((s, o) => s + o.amountCents, 0),
    previousRevenueCents: previous.reduce((s, o) => s + o.amountCents, 0),
    paidOrders: current.length,
    pendingOrders: pending,
    newCustomers,
    byStatus,
    daily,
    topPackages: [...top.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 5),
  }
}

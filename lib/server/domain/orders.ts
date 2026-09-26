import type { AdminOrderDetail, AdminOrderRow, OrderFilters } from '@/lib/contracts'
import { entitlementStatus } from '@/lib/entitlements'
import { ServiceError } from '@/lib/services/errors'
import { and, desc, eq, gte, ilike, or, type SQL } from 'drizzle-orm'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { requireAdmin, type Actor } from '../guards'
import { toEntitlement, toOrder, toPackage, toUser } from '../mappers'
import { approveOrder, reverseOrder } from './fulfillment'

const DAY = 24 * 60 * 60 * 1000

export async function list(db: Db, actor: Actor, filters: OrderFilters = {}): Promise<AdminOrderRow[]> {
  requireAdmin(actor)
  const where: SQL[] = []
  if (filters.status && filters.status !== 'all') where.push(eq(t.orders.status, filters.status))
  if (filters.days) where.push(gte(t.orders.createdAt, new Date(Date.now() - filters.days * DAY)))
  const q = filters.search?.trim()
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    where.push(or(ilike(t.orders.id, pattern), ilike(t.orders.name, pattern), ilike(t.orders.email, pattern))!)
  }
  const rows = await db
    .select({ order: t.orders, packageTitle: t.packages.title })
    .from(t.orders)
    .leftJoin(t.packages, eq(t.orders.packageId, t.packages.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(t.orders.createdAt))
  return rows.map((r) => ({ ...toOrder(r.order), packageTitle: r.packageTitle ?? '—' }))
}

export async function get(db: Db, actor: Actor, id: string): Promise<AdminOrderDetail> {
  requireAdmin(actor)
  const [order] = await db.select().from(t.orders).where(eq(t.orders.id, id))
  if (!order) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
  const [[pkg], user, [ent]] = await Promise.all([
    db.select().from(t.packages).where(eq(t.packages.id, order.packageId)),
    order.userId ? db.select().from(t.users).where(eq(t.users.id, order.userId)) : Promise.resolve([]),
    db.select().from(t.entitlements).where(eq(t.entitlements.orderId, id)),
  ])
  const entitlement = ent ? toEntitlement(ent) : null
  return {
    order: toOrder(order),
    // Os arquivos do pacote não são necessários nesta tela.
    package: pkg ? toPackage(pkg, []) : null,
    customer: user[0] ? toUser(user[0]) : null,
    entitlement: entitlement ? { ...entitlement, status: entitlementStatus(entitlement) } : null,
  }
}

/** Confirma manualmente um pagamento pendente (equivale a receber o webhook "approved"). */
export async function approve(db: Db, actor: Actor, id: string) {
  requireAdmin(actor)
  await db.transaction(async (tx) => {
    const [order] = await tx.select({ status: t.orders.status }).from(t.orders).where(eq(t.orders.id, id)).for('update')
    if (!order) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
    if (order.status !== 'pending') throw new ServiceError('CONFLICT', 'Só pedidos pendentes podem ser aprovados.')
    await approveOrder(tx, id)
  })
}

/** Reembolso. Na fase 4 também chama POST /v1/payments/{id}/refunds no Mercado Pago. Revoga o acesso. */
export async function refund(db: Db, actor: Actor, id: string) {
  requireAdmin(actor)
  await db.transaction(async (tx) => {
    const [order] = await tx.select({ status: t.orders.status }).from(t.orders).where(eq(t.orders.id, id)).for('update')
    if (!order) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
    if (order.status !== 'approved') throw new ServiceError('CONFLICT', 'Só pedidos aprovados podem ser reembolsados.')
    await reverseOrder(tx, id, 'refunded')
  })
}

/** Só no modo de simulação: equivale ao webhook de chargeback. */
export async function simulateChargeback(db: Db, actor: Actor, id: string) {
  requireAdmin(actor)
  await db.transaction(async (tx) => {
    const [order] = await tx.select({ status: t.orders.status }).from(t.orders).where(eq(t.orders.id, id)).for('update')
    if (order?.status === 'approved') await reverseOrder(tx, id, 'charged_back')
  })
}

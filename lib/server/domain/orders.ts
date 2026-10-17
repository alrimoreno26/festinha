import { productionUpdateSchema, type AdminOrderDetail, type AdminOrderRow, type OrderFilters } from '@/lib/contracts'
import { entitlementStatus } from '@/lib/entitlements'
import { ServiceError } from '@/lib/services/errors'
import type { ProductionStatus } from '@/lib/types'
import { and, asc, desc, eq, gte, ilike, inArray, or, sql, type SQL } from 'drizzle-orm'
import type { z } from 'zod'
import { trackingUrl } from '@/lib/address'
import * as messages from '../email/messages'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { requireAdmin, type Actor } from '../guards'
import { toEntitlement, toFile, toOrder, toPackage, toUser } from '../mappers'
import { getPaymentGateway, type PaymentGateway } from '../payments'
import { approveOrder, reverseOrder, sendEmail } from './fulfillment'

const DAY = 24 * 60 * 60 * 1000

export async function list(db: Db, actor: Actor, filters: OrderFilters = {}): Promise<AdminOrderRow[]> {
  requireAdmin(actor)
  const where: SQL[] = []
  if (filters.status && filters.status !== 'all') where.push(eq(t.orders.status, filters.status))
  if (filters.days) where.push(gte(t.orders.createdAt, new Date(Date.now() - filters.days * DAY)))
  if (filters.toProduce) where.push(eq(t.orders.status, 'approved'), inArray(t.orders.productionStatus, ['in_production', 'ready']))
  const q = filters.search?.trim()
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    where.push(or(ilike(t.orders.id, pattern), ilike(t.orders.name, pattern), ilike(t.orders.email, pattern))!)
  }
  const rows = await db
    .select({ order: t.orders, packageTitle: t.packages.title, packageKind: t.packages.kind })
    .from(t.orders)
    .leftJoin(t.packages, eq(t.orders.packageId, t.packages.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(t.orders.createdAt))
  return rows.map((r) => ({ ...toOrder(r.order), packageTitle: r.packageTitle ?? '—', packageKind: r.packageKind ?? 'digital' }))
}

export async function get(db: Db, actor: Actor, id: string): Promise<AdminOrderDetail> {
  requireAdmin(actor)
  const [order] = await db.select().from(t.orders).where(eq(t.orders.id, id))
  if (!order) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
  const [[pkg], user, [ent], files] = await Promise.all([
    db.select().from(t.packages).where(eq(t.packages.id, order.packageId)),
    order.userId ? db.select().from(t.users).where(eq(t.users.id, order.userId)) : Promise.resolve([]),
    db.select().from(t.entitlements).where(eq(t.entitlements.orderId, id)),
    orderFilesOf(db, id),
  ])
  const entitlement = ent ? toEntitlement(ent) : null
  return {
    payment: { provider: order.mpPreferenceId ? 'mercadopago' : 'simulator', mpPaymentId: order.mpPaymentId, mpStatus: order.mpStatus },
    order: toOrder(order),
    // Os arquivos do pacote não são necessários nesta tela.
    package: pkg ? toPackage(pkg, []) : null,
    customer: user[0] ? toUser(user[0]) : null,
    entitlement: entitlement ? { ...entitlement, status: entitlementStatus(entitlement) } : null,
    files: files.map(toFile),
  }
}

export async function orderFilesOf(db: Db, orderId: string) {
  return (
    await db
      .select({ file: t.files })
      .from(t.orderFiles)
      .innerJoin(t.files, eq(t.orderFiles.fileId, t.files.id))
      .where(eq(t.orderFiles.orderId, orderId))
      .orderBy(asc(t.orderFiles.position))
  ).map((r) => r.file)
}

/** Etapas válidas por tipo: o impresso passa por "pronto" (retirada/entrega); o digital vai direto para entregue. */
const STEPS: Record<'custom_digital' | 'printed', ProductionStatus[]> = {
  custom_digital: ['in_production', 'delivered'],
  printed: ['in_production', 'ready', 'delivered'],
}

/**
 * Atualiza o andamento de um pedido sob encomenda e, no personalizado digital, anexa os arquivos finais
 * (já enviados ao bucket pelo upload normal). Avisa o cliente por email quando fica pronto.
 */
export async function updateProduction(db: Db, actor: Actor, id: string, input: z.input<typeof productionUpdateSchema>) {
  requireAdmin(actor)
  const parsed = productionUpdateSchema.safeParse(input)
  if (!parsed.success) throw new ServiceError('VALIDATION', 'Dados inválidos.')
  const { status, fileIds = [] } = parsed.data
  const trackingCode = parsed.data.trackingCode?.toUpperCase() || null

  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ order: t.orders, pkg: { title: t.packages.title, kind: t.packages.kind } })
      .from(t.orders)
      .innerJoin(t.packages, eq(t.orders.packageId, t.packages.id))
      .where(eq(t.orders.id, id))
      .for('update', { of: t.orders })
    if (!row) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
    const { order, pkg } = row
    if (pkg.kind === 'digital') throw new ServiceError('CONFLICT', 'Kits digitais prontos não têm etapa de produção.')
    if (order.status !== 'approved') throw new ServiceError('CONFLICT', 'Só pedidos pagos entram em produção.')
    if (!STEPS[pkg.kind].includes(status)) throw new ServiceError('VALIDATION', 'Etapa inválida para este tipo de pedido.')

    if (fileIds.length) {
      if (pkg.kind !== 'custom_digital') throw new ServiceError('VALIDATION', 'Só pedidos personalizados digitais recebem arquivos.')
      const found = await tx.select({ id: t.files.id }).from(t.files).where(inArray(t.files.id, fileIds))
      if (found.length !== new Set(fileIds).size) throw new ServiceError('VALIDATION', 'Alguns arquivos não foram encontrados.')
      const [{ next }] = await tx
        .select({ next: sql<number>`coalesce(max(${t.orderFiles.position}) + 1, 0)::int` })
        .from(t.orderFiles)
        .where(eq(t.orderFiles.orderId, id))
      await tx
        .insert(t.orderFiles)
        .values([...new Set(fileIds)].map((fileId, i) => ({ orderId: id, fileId, position: next + i })))
        .onConflictDoNothing()
    }

    if (pkg.kind === 'custom_digital' && status === 'delivered') {
      const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(t.orderFiles).where(eq(t.orderFiles.orderId, id))
      if (!count) throw new ServiceError('VALIDATION', 'Envie o arquivo final antes de marcar como entregue.')
    }

    const shipped = pkg.kind === 'printed' && order.deliveryMethod === 'shipping'
    if (trackingCode && !shipped) throw new ServiceError('VALIDATION', 'Só pedidos enviados têm código de rastreio.')
    // Corrigir o código de rastreio sem mudar a etapa.
    if (trackingCode && trackingCode !== order.trackingCode) await tx.update(t.orders).set({ trackingCode }).where(eq(t.orders.id, id))

    if (status === order.productionStatus) return
    await tx.update(t.orders).set({ productionStatus: status }).where(eq(t.orders.id, id))

    if (pkg.kind === 'custom_digital' && status === 'delivered')
      await sendEmail(tx, { to: order.email, ...messages.customReady({ name: order.name, kit: pkg.title }) })
    if (pkg.kind === 'printed' && status === 'ready') {
      const code = trackingCode ?? order.trackingCode
      await sendEmail(tx, {
        to: order.email,
        ...(shipped
          ? messages.printedShipped({
              name: order.name,
              kit: pkg.title,
              carrier: order.shipping?.company ?? '',
              trackingCode: code,
              trackingUrl: code ? trackingUrl(code) : null,
            })
          : messages.printedReady({ name: order.name, kit: pkg.title })),
      })
    }
  })
  return get(db, actor, id)
}

/** Tira um arquivo enviado por engano do pedido (o arquivo continua no explorador). */
export async function detachFile(db: Db, actor: Actor, id: string, fileId: string) {
  requireAdmin(actor)
  await db.delete(t.orderFiles).where(and(eq(t.orderFiles.orderId, id), eq(t.orderFiles.fileId, fileId)))
  return get(db, actor, id)
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

/**
 * Reembolso total. Pedido pago pelo Mercado Pago: pede o estorno ao MP primeiro (se o MP recusar,
 * nada muda aqui). Depois revoga o acesso. O webhook "refunded" que o MP manda em seguida é ignorado
 * por já estar aplicado.
 */
export async function refund(db: Db, actor: Actor, id: string, gateway: PaymentGateway = getPaymentGateway()) {
  requireAdmin(actor)
  const [order] = await db.select().from(t.orders).where(eq(t.orders.id, id))
  if (!order) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
  if (order.status !== 'approved') throw new ServiceError('CONFLICT', 'Só pedidos aprovados podem ser reembolsados.')

  if (order.mpPaymentId) {
    if (gateway.kind !== 'mercadopago') throw new ServiceError('CONFLICT', 'Mercado Pago não configurado: não é possível estornar este pagamento.')
    try {
      await gateway.refund(order.mpPaymentId)
    } catch (err) {
      console.error('[reembolso] o Mercado Pago recusou o estorno', id, err)
      throw new ServiceError('CONFLICT', 'O Mercado Pago não aceitou o estorno. Verifique o pagamento no painel do Mercado Pago.')
    }
  }

  await db.transaction(async (tx) => {
    const [locked] = await tx.select({ status: t.orders.status }).from(t.orders).where(eq(t.orders.id, id)).for('update')
    // O webhook pode ter chegado antes e já revogado.
    if (locked?.status === 'approved') await reverseOrder(tx, id, 'refunded')
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

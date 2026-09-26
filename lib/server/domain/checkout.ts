// Fluxo público de compra.
// Fase 4: createOrder também cria a preferência no Mercado Pago e devolve o `init_point`;
// a confirmação chega pelo webhook. Até lá, `simulatePayment` faz o papel do Mercado Pago.

import { checkoutSchema, zodDetails, type CheckoutInput, type PublicOrder } from '@/lib/contracts'
import { ServiceError } from '@/lib/services/errors'
import type { PaymentMethod } from '@/lib/types'
import { and, eq, isNotNull, lte } from 'drizzle-orm'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { newId } from '../ids'
import { approveOrder } from './fulfillment'

const PIX_TTL_MS = 30 * 60 * 1000

export type SimulatedOutcome = 'approved' | 'pending' | 'rejected'

async function toPublicOrder(db: Db, orderId: string): Promise<PublicOrder> {
  const [row] = await db
    .select({ order: t.orders, pkg: { title: t.packages.title, slug: t.packages.slug } })
    .from(t.orders)
    .leftJoin(t.packages, eq(t.orders.packageId, t.packages.id))
    .where(eq(t.orders.id, orderId))
  if (!row) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
  const { order, pkg } = row
  const [user] = await db.select({ createdAt: t.users.createdAt }).from(t.users).where(eq(t.users.email, order.email))

  return {
    id: order.id,
    status: order.status,
    method: order.method,
    amountCents: order.amountCents,
    email: order.email,
    packageTitle: pkg?.title ?? 'Pacote',
    packageSlug: pkg?.slug ?? '',
    createdAt: order.createdAt.toISOString(),
    existingAccount: !!user && user.createdAt < order.createdAt,
    // QR fictício até a fase 4 (lá vem de point_of_interaction.transaction_data do Mercado Pago).
    pix:
      order.method === 'pix' && order.status === 'pending'
        ? {
            copyPaste: `00020126580014BR.GOV.BCB.PIX0136festinhas-${order.id}5204000053039865406${(order.amountCents / 100).toFixed(2)}5802BR`,
            expiresAt: new Date(order.createdAt.getTime() + PIX_TTL_MS).toISOString(),
          }
        : null,
  }
}

export async function createOrder(db: Db, input: CheckoutInput) {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) throw new ServiceError('VALIDATION', 'Revise os campos destacados.', zodDetails(parsed.error))

  const [pkg] = await db
    .select()
    .from(t.packages)
    .where(and(eq(t.packages.slug, parsed.data.packageSlug), eq(t.packages.active, true)))
  if (!pkg) throw new ServiceError('NOT_FOUND', 'Este pacote não está mais disponível.')

  const id = newId('ord')
  await db.insert(t.orders).values({
    id,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    packageId: pkg.id,
    // O preço vem sempre do banco, nunca do navegador.
    amountCents: pkg.priceCents,
  })
  return { orderId: id, checkoutUrl: `/simulador-mp/${id}` }
}

/** Status público de um pedido (quem tem o ID do pedido pode consultar, como no retorno do Mercado Pago). */
export async function getOrder(db: Db, orderId: string) {
  // Simulador: confirma Pix pendentes cujo prazo simulado já passou.
  const [due] = await db
    .select({ id: t.orders.id })
    .from(t.orders)
    .where(and(eq(t.orders.id, orderId), eq(t.orders.status, 'pending'), isNotNull(t.orders.simulatedApproveAt), lte(t.orders.simulatedApproveAt, new Date())))
  if (due) await db.transaction((tx) => approveOrder(tx, orderId))
  return toPublicOrder(db, orderId)
}

/** Faz o papel da página de pagamento do Mercado Pago. Só existe com o modo de simulação ligado. */
export async function simulatePayment(
  db: Db,
  orderId: string,
  method: PaymentMethod,
  { outcome, pixAutoConfirmSeconds }: { outcome: SimulatedOutcome; pixAutoConfirmSeconds: number },
) {
  const returnUrl = `/checkout/retorno?pedido=${orderId}`
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(t.orders).where(eq(t.orders.id, orderId)).for('update')
    if (!order) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
    if (order.status !== 'pending') return

    if (outcome === 'rejected') {
      await tx.update(t.orders).set({ method, status: 'rejected' }).where(eq(t.orders.id, orderId))
    } else if (outcome === 'pending' && method === 'pix') {
      const at = pixAutoConfirmSeconds > 0 ? new Date(Date.now() + pixAutoConfirmSeconds * 1000) : null
      await tx.update(t.orders).set({ method, simulatedApproveAt: at }).where(eq(t.orders.id, orderId))
    } else {
      await tx.update(t.orders).set({ method }).where(eq(t.orders.id, orderId))
      await approveOrder(tx, orderId)
    }
  })
  return { returnUrl }
}

/** Tentar de novo após recusa/expiração: novo pedido com os mesmos dados (e o preço atual). */
export async function retry(db: Db, orderId: string) {
  const [old] = await db.select().from(t.orders).where(eq(t.orders.id, orderId))
  if (!old) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
  const [pkg] = await db.select().from(t.packages).where(and(eq(t.packages.id, old.packageId), eq(t.packages.active, true)))
  if (!pkg) throw new ServiceError('NOT_FOUND', 'Este pacote não está mais disponível.')
  const id = newId('ord')
  await db.insert(t.orders).values({
    id,
    name: old.name,
    email: old.email,
    phone: old.phone,
    packageId: pkg.id,
    amountCents: pkg.priceCents,
    method: old.method,
  })
  return { orderId: id, checkoutUrl: `/simulador-mp/${id}` }
}

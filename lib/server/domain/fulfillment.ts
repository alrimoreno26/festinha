// Regras disparadas pelo webhook do Mercado Pago (e pela confirmação manual). Sempre chamadas dentro de transação.

import { addDays } from '@/lib/entitlements'
import type { OrderStatus } from '@/lib/types'
import { and, eq, isNull } from 'drizzle-orm'
import { generateTempPassword, hashPassword } from '../auth/password'
import * as messages from '../email/messages'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { newId } from '../ids'
import { emailConfig } from '../email/mailer'
import { notifyTelegram, orderPaidMessage } from '../telegram'

export interface EmailInput {
  to: string
  subject: string
  body: string
  actionUrl?: string
  actionLabel?: string
}

/** Enfileira um email. Na fase 5 um processo envia os pendentes pelo Resend. */
export async function sendEmail(db: Db, email: EmailInput) {
  await db.insert(t.emailOutbox).values({ id: newId('eml'), ...email })
}

/**
 * Concede acesso a um pacote. Se o cliente já tiver acesso, renova:
 * reativa se estava revogado e soma os dias a partir de hoje (ou do vencimento atual, o que for maior).
 */
export async function grantEntitlement(
  db: Db,
  { userId, packageId, orderId, accessDays }: { userId: string; packageId: string; orderId: string | null; accessDays: number | null },
) {
  const now = new Date()
  const [existing] = await db
    .select()
    .from(t.entitlements)
    .where(and(eq(t.entitlements.userId, userId), eq(t.entitlements.packageId, packageId)))

  if (existing) {
    const stillValid = existing.expiresAt && !existing.revokedAt && existing.expiresAt > now
    const base = stillValid ? existing.expiresAt! : now
    const [updated] = await db
      .update(t.entitlements)
      .set({
        revokedAt: null,
        orderId: orderId ?? existing.orderId,
        expiresAt: accessDays === null ? null : addDays(base, accessDays),
      })
      .where(eq(t.entitlements.id, existing.id))
      .returning()
    return updated
  }

  const [created] = await db
    .insert(t.entitlements)
    .values({
      id: newId('ent'),
      userId,
      packageId,
      orderId,
      grantedBy: orderId ? 'purchase' : 'manual',
      expiresAt: accessDays === null ? null : addDays(now, accessDays),
    })
    .returning()
  return created
}

/**
 * Pagamento aprovado: cria/acha o cliente, libera (ou renova) o acesso e envia o email.
 * Idempotente: chamar duas vezes para o mesmo pedido não faz nada na segunda.
 */
export async function approveOrder(db: Db, orderId: string) {
  // Trava a linha do pedido: dois webhooks simultâneos não liberam o acesso duas vezes.
  const [order] = await db.select().from(t.orders).where(eq(t.orders.id, orderId)).for('update')
  if (!order) return { approved: false as const, reason: 'not_found' as const }
  if (order.status === 'approved') return { approved: false as const, reason: 'already_approved' as const }

  const [pkg] = await db.select().from(t.packages).where(eq(t.packages.id, order.packageId))
  if (!pkg) return { approved: false as const, reason: 'package_missing' as const }

  const email = order.email.toLowerCase()
  let [user] = await db.select().from(t.users).where(eq(t.users.email, email))
  let tempPassword: string | null = null
  if (!user) {
    tempPassword = generateTempPassword()
    ;[user] = await db
      .insert(t.users)
      .values({
        id: newId('usr'),
        email,
        name: order.name,
        phone: order.phone,
        role: 'customer',
        mustChangePassword: true,
        passwordHash: await hashPassword(tempPassword),
      })
      .returning()
  }

  // Kit pronto: libera o download na hora. Sob encomenda: entra em produção (a arte/o impresso vem depois).
  const madeToOrder = pkg.kind !== 'digital'
  await db
    .update(t.orders)
    .set({ status: 'approved', paidAt: new Date(), userId: user.id, simulatedApproveAt: null, productionStatus: madeToOrder ? 'in_production' : null })
    .where(eq(t.orders.id, orderId))

  // Aviso para a loja (Telegram), na mesma transação: só sai se o pedido foi mesmo aprovado.
  await notifyTelegram(
    db,
    orderPaidMessage({
      orderId,
      packageTitle: pkg.title,
      packageKind: pkg.kind,
      amountCents: order.amountCents,
      method: order.method,
      name: order.name,
      email: order.email,
      phone: order.phone,
      customization: order.customization,
      deliveryMethod: order.deliveryMethod,
      shippingAddress: order.shippingAddress,
      shipping: order.shipping,
      newCustomer: !!tempPassword,
      appUrl: emailConfig().appUrl,
    }),
  )

  if (madeToOrder) {
    await sendEmail(db, {
      to: user.email,
      ...messages.orderReceived({
        name: user.name,
        email: user.email,
        tempPassword,
        kit: pkg.title,
        printed: pkg.kind === 'printed',
        customization: order.customization,
      }),
    })
    return { approved: true as const, userId: user.id, createdUser: !!tempPassword }
  }

  await grantEntitlement(db, { userId: user.id, packageId: pkg.id, orderId, accessDays: pkg.accessDays })

  await sendEmail(db, {
    to: user.email,
    ...(tempPassword
      ? messages.purchaseNewCustomer({ name: user.name, email: user.email, tempPassword, kit: pkg.title })
      : messages.purchaseExistingCustomer({ name: user.name, kit: pkg.title })),
  })

  return { approved: true as const, userId: user.id, createdUser: !!tempPassword }
}

/** Reembolso ou chargeback: marca o pedido e revoga o acesso ligado a ele. */
export async function reverseOrder(db: Db, orderId: string, status: Extract<OrderStatus, 'refunded' | 'charged_back'>) {
  await db.update(t.orders).set({ status }).where(eq(t.orders.id, orderId))
  await db
    .update(t.entitlements)
    .set({ revokedAt: new Date() })
    .where(and(eq(t.entitlements.orderId, orderId), isNull(t.entitlements.revokedAt)))
}

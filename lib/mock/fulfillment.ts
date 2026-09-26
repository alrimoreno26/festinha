// Regras que no backend real rodarão no webhook do Mercado Pago.
// Mantidas aqui isoladas para serem portadas quase 1:1.

import { addDays } from '@/lib/entitlements'
import type { Entitlement, Order, OutboxEmail } from '@/lib/types'
import { generateTempPassword } from './session'
import { newId, type MockDB } from './store'

export function sendEmail(db: MockDB, email: Omit<OutboxEmail, 'id' | 'createdAt'>) {
  db.outbox.unshift({ ...email, id: newId('eml'), createdAt: new Date().toISOString() })
}

/** Pagamento aprovado: cria/acha o cliente, libera (ou renova) o acesso e envia o email. */
export function approveOrder(db: MockDB, orderId: string) {
  const order = db.orders.find((o) => o.id === orderId)
  if (!order || order.status === 'approved') return
  const pkg = db.packages.find((p) => p.id === order.packageId)
  if (!pkg) return

  const now = new Date()
  order.status = 'approved'
  order.paidAt = now.toISOString()

  let user = db.users.find((u) => u.email.toLowerCase() === order.email.toLowerCase())
  let tempPassword: string | null = null
  if (!user) {
    tempPassword = generateTempPassword()
    user = {
      id: newId('usr'),
      email: order.email.toLowerCase(),
      name: order.name,
      phone: order.phone,
      role: 'customer',
      mustChangePassword: true,
      password: tempPassword,
      createdAt: now.toISOString(),
    }
    db.users.push(user)
  }
  order.userId = user.id

  grantEntitlement(db, { userId: user.id, packageId: pkg.id, orderId: order.id, accessDays: pkg.accessDays })

  sendEmail(db, {
    to: user.email,
    subject: `Seu ${pkg.title} está liberado! 🎉`,
    body: tempPassword
      ? `Olá, ${user.name}! Seu pagamento foi confirmado.\n\nAcesse a Área do Cliente com:\nEmail: ${user.email}\nSenha temporária: ${tempPassword}\n\nNo primeiro acesso você vai criar sua própria senha.`
      : `Olá, ${user.name}! Seu pagamento foi confirmado e o ${pkg.title} já está na sua conta. Entre com seu email e senha de sempre.`,
    actionUrl: '/conta/login',
    actionLabel: 'Acessar meus kits',
  })
}

/**
 * Concede acesso a um pacote. Se o cliente já tiver acesso, renova:
 * reativa se estava revogado e soma os dias a partir de hoje (ou do vencimento atual, o que for maior).
 */
export function grantEntitlement(
  db: MockDB,
  { userId, packageId, orderId, accessDays }: { userId: string; packageId: string; orderId: string | null; accessDays: number | null },
): Entitlement {
  const now = new Date()
  const existing = db.entitlements.find((e) => e.userId === userId && e.packageId === packageId)

  if (existing) {
    const base =
      existing.expiresAt && !existing.revokedAt && new Date(existing.expiresAt) > now ? new Date(existing.expiresAt) : now
    existing.revokedAt = null
    existing.orderId = orderId ?? existing.orderId
    existing.expiresAt = accessDays === null ? null : addDays(base, accessDays).toISOString()
    return existing
  }

  const entitlement: Entitlement = {
    id: newId('ent'),
    userId,
    packageId,
    orderId,
    grantedBy: orderId ? 'purchase' : 'manual',
    createdAt: now.toISOString(),
    expiresAt: accessDays === null ? null : addDays(now, accessDays).toISOString(),
    revokedAt: null,
  }
  db.entitlements.push(entitlement)
  return entitlement
}

/** Reembolso ou chargeback: marca o pedido e revoga o acesso ligado a ele. */
export function reverseOrder(db: MockDB, orderId: string, status: Extract<Order['status'], 'refunded' | 'charged_back'>) {
  const order = db.orders.find((o) => o.id === orderId)
  if (!order) return
  order.status = status
  db.entitlements
    .filter((e) => e.orderId === orderId && !e.revokedAt)
    .forEach((e) => (e.revokedAt = new Date().toISOString()))
}

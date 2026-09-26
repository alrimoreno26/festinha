// Converte linhas do banco (Date, colunas internas) nos tipos de domínio usados pela UI (ISO strings).

import type { Entitlement, FileItem, Order, OutboxEmail, Package, User } from '@/lib/types'
import type * as t from './db/schema'

type Row<T extends { $inferSelect: unknown }> = T['$inferSelect']

const iso = (d: Date) => d.toISOString()
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null)

export function toUser(u: Row<typeof t.users>): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    mustChangePassword: u.mustChangePassword,
    createdAt: iso(u.createdAt),
  }
}

export function toFile(f: Row<typeof t.files>): FileItem {
  return { id: f.id, key: f.key, filename: f.filename, size: f.size, mime: f.mime, createdAt: iso(f.createdAt) }
}

export function toPackage(p: Row<typeof t.packages>, fileIds: string[]): Package {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    coverUrl: p.coverUrl,
    priceCents: p.priceCents,
    active: p.active,
    accessDays: p.accessDays,
    fileIds,
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt),
  }
}

export function toOrder(o: Row<typeof t.orders>): Order {
  return {
    id: o.id,
    userId: o.userId,
    name: o.name,
    email: o.email,
    phone: o.phone,
    packageId: o.packageId,
    amountCents: o.amountCents,
    status: o.status,
    method: o.method,
    createdAt: iso(o.createdAt),
    paidAt: isoOrNull(o.paidAt),
  }
}

export function toEntitlement(e: Row<typeof t.entitlements>): Entitlement {
  return {
    id: e.id,
    userId: e.userId,
    packageId: e.packageId,
    orderId: e.orderId,
    grantedBy: e.grantedBy,
    createdAt: iso(e.createdAt),
    expiresAt: isoOrNull(e.expiresAt),
    revokedAt: isoOrNull(e.revokedAt),
  }
}

export function toOutboxEmail(m: Row<typeof t.emailOutbox>): OutboxEmail {
  return {
    id: m.id,
    to: m.to,
    subject: m.subject,
    body: m.body,
    actionUrl: m.actionUrl ?? undefined,
    actionLabel: m.actionLabel ?? undefined,
    createdAt: iso(m.createdAt),
  }
}

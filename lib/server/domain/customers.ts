import { newCustomerSchema, zodDetails, type CustomerDetail, type CustomerRow } from '@/lib/contracts'
import { canDownload, entitlementStatus } from '@/lib/entitlements'
import { ServiceError } from '@/lib/services/errors'
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm'
import type { z } from 'zod'
import { generateTempPassword, hashPassword } from '../auth/password'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { requireAdmin, type Actor } from '../guards'
import { newId } from '../ids'
import { toEntitlement, toOrder, toUser } from '../mappers'
import { grantEntitlement, sendEmail } from './fulfillment'

async function loadCustomer(db: Db, id: string) {
  const [user] = await db.select().from(t.users).where(and(eq(t.users.id, id), eq(t.users.role, 'customer')))
  if (!user) throw new ServiceError('NOT_FOUND', 'Cliente não encontrado.')
  return user
}

export async function list(db: Db, actor: Actor, search = ''): Promise<CustomerRow[]> {
  requireAdmin(actor)
  const where: SQL[] = [eq(t.users.role, 'customer')]
  const q = search.trim()
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    where.push(or(ilike(t.users.name, pattern), ilike(t.users.email, pattern), ilike(t.users.phone, pattern))!)
  }
  const users = await db.select().from(t.users).where(and(...where))
  if (!users.length) return []
  const ids = users.map((u) => u.id)

  const [orderStats, ents] = await Promise.all([
    db
      .select({
        userId: t.orders.userId,
        ordersCount: sql<number>`count(*)::int`,
        totalSpentCents: sql<number>`coalesce(sum(${t.orders.amountCents}) filter (where ${t.orders.status} = 'approved'), 0)::int`,
        lastOrderAt: sql<Date>`max(${t.orders.createdAt})`,
      })
      .from(t.orders)
      .where(inArray(t.orders.userId, ids))
      .groupBy(t.orders.userId),
    db.select().from(t.entitlements).where(inArray(t.entitlements.userId, ids)),
  ])

  return users
    .map((u) => {
      const stats = orderStats.find((s) => s.userId === u.id)
      const lastOrderAt = stats?.lastOrderAt ? new Date(stats.lastOrderAt).toISOString() : null
      return {
        ...toUser(u),
        ordersCount: stats?.ordersCount ?? 0,
        totalSpentCents: stats?.totalSpentCents ?? 0,
        activeKits: ents.filter((e) => e.userId === u.id && canDownload(entitlementStatus(toEntitlement(e)))).length,
        lastOrderAt,
      }
    })
    .sort((a, b) => (b.lastOrderAt ?? b.createdAt).localeCompare(a.lastOrderAt ?? a.createdAt))
}

export async function get(db: Db, actor: Actor, id: string): Promise<CustomerDetail> {
  requireAdmin(actor)
  const user = await loadCustomer(db, id)
  const [orders, ents, [{ downloads }]] = await Promise.all([
    db
      .select({ order: t.orders, packageTitle: t.packages.title })
      .from(t.orders)
      .leftJoin(t.packages, eq(t.orders.packageId, t.packages.id))
      .where(eq(t.orders.userId, id))
      .orderBy(desc(t.orders.createdAt)),
    db
      .select({ ent: t.entitlements, pkg: { id: t.packages.id, title: t.packages.title, slug: t.packages.slug, coverUrl: t.packages.coverUrl } })
      .from(t.entitlements)
      .innerJoin(t.packages, eq(t.entitlements.packageId, t.packages.id))
      .where(eq(t.entitlements.userId, id))
      .orderBy(desc(t.entitlements.createdAt)),
    db.select({ downloads: sql<number>`count(*)::int` }).from(t.downloads).where(eq(t.downloads.userId, id)),
  ])
  return {
    customer: toUser(user),
    orders: orders.map((r) => ({ ...toOrder(r.order), packageTitle: r.packageTitle ?? '—' })),
    entitlements: ents.map(({ ent, pkg }) => {
      const e = toEntitlement(ent)
      return { ...e, status: entitlementStatus(e), package: pkg }
    }),
    downloadsCount: downloads,
  }
}

/** Cadastro manual (ex.: venda feita pelo WhatsApp). Envia a senha temporária por email. */
export async function create(db: Db, actor: Actor, input: z.input<typeof newCustomerSchema>) {
  requireAdmin(actor)
  const parsed = newCustomerSchema.safeParse(input)
  if (!parsed.success) throw new ServiceError('VALIDATION', 'Revise os campos destacados.', zodDetails(parsed.error))
  const [dup] = await db.select({ id: t.users.id }).from(t.users).where(eq(t.users.email, parsed.data.email))
  if (dup) throw new ServiceError('CONFLICT', 'Já existe um cliente com este email.', { email: 'Email já cadastrado.' })

  const password = generateTempPassword()
  const passwordHash = await hashPassword(password)
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(t.users)
      .values({
        id: newId('usr'),
        email: parsed.data.email,
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        role: 'customer',
        mustChangePassword: true,
        passwordHash,
      })
      .returning()
    await sendEmail(tx, {
      to: user.email,
      subject: 'Sua conta na Festinhas foi criada',
      body: `Olá, ${user.name}! Criamos sua conta na Área do Cliente.\n\nEmail: ${user.email}\nSenha temporária: ${password}`,
      actionUrl: '/conta/login',
      actionLabel: 'Acessar',
    })
    return toUser(user)
  })
}

export async function grantAccess(db: Db, actor: Actor, userId: string, packageId: string, accessDays: number | null) {
  requireAdmin(actor)
  if (accessDays !== null && (!Number.isInteger(accessDays) || accessDays < 1)) throw new ServiceError('VALIDATION', 'Número de dias inválido.')
  const user = await loadCustomer(db, userId)
  const [pkg] = await db.select().from(t.packages).where(eq(t.packages.id, packageId))
  if (!pkg) throw new ServiceError('NOT_FOUND', 'Pacote não encontrado.')
  await db.transaction(async (tx) => {
    await grantEntitlement(tx, { userId, packageId, orderId: null, accessDays })
    await sendEmail(tx, {
      to: user.email,
      subject: `Você ganhou acesso ao ${pkg.title}`,
      body: `Olá, ${user.name}! O ${pkg.title} já está disponível na sua Área do Cliente.`,
      actionUrl: '/conta',
      actionLabel: 'Ver meus kits',
    })
  })
}

async function setRevoked(db: Db, entitlementId: string, revokedAt: Date | null) {
  const [row] = await db.update(t.entitlements).set({ revokedAt }).where(eq(t.entitlements.id, entitlementId)).returning({ id: t.entitlements.id })
  if (!row) throw new ServiceError('NOT_FOUND', 'Acesso não encontrado.')
}

export async function revokeAccess(db: Db, actor: Actor, entitlementId: string) {
  requireAdmin(actor)
  await setRevoked(db, entitlementId, new Date())
}

export async function restoreAccess(db: Db, actor: Actor, entitlementId: string) {
  requireAdmin(actor)
  await setRevoked(db, entitlementId, null)
}

/** Gera nova senha temporária, encerra as sessões do cliente e reenvia o email de acesso. */
export async function resendAccess(db: Db, actor: Actor, userId: string) {
  requireAdmin(actor)
  const user = await loadCustomer(db, userId)
  const password = generateTempPassword()
  const passwordHash = await hashPassword(password)
  await db.transaction(async (tx) => {
    await tx.update(t.users).set({ passwordHash, mustChangePassword: true, updatedAt: new Date() }).where(eq(t.users.id, userId))
    await tx.delete(t.sessions).where(eq(t.sessions.userId, userId))
    await sendEmail(tx, {
      to: user.email,
      subject: 'Seus dados de acesso',
      body: `Olá, ${user.name}! Aqui estão seus novos dados de acesso.\n\nEmail: ${user.email}\nSenha temporária: ${password}`,
      actionUrl: '/conta/login',
      actionLabel: 'Acessar meus kits',
    })
  })
}

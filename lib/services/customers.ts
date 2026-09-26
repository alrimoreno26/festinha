import { canDownload, entitlementStatus } from '@/lib/entitlements'
import { mockCall } from '@/lib/mock/call'
import { grantEntitlement, sendEmail } from '@/lib/mock/fulfillment'
import { generateTempPassword, publicUser, requireAdmin } from '@/lib/mock/session'
import { getDb, mutate, newId } from '@/lib/mock/store'
import { newCustomerSchema, zodDetails, type CustomerDetail, type CustomerRow } from '@/lib/contracts'
import type { z } from 'zod'
import { ServiceError } from './errors'

export { newCustomerSchema } from '@/lib/contracts'
export type { CustomerDetail, CustomerEntitlement, CustomerRow } from '@/lib/contracts'

export const customersService = {
  list: (search = '') =>
    mockCall<CustomerRow[]>(() => {
      const db = getDb()
      requireAdmin(db)
      const q = search.trim().toLowerCase()
      return db.users
        .filter((u) => u.role === 'customer')
        .filter((u) => !q || [u.name, u.email, u.phone ?? ''].some((v) => v.toLowerCase().includes(q)))
        .map((u) => {
          const orders = db.orders.filter((o) => o.userId === u.id)
          const paid = orders.filter((o) => o.status === 'approved')
          return {
            ...publicUser(u),
            ordersCount: orders.length,
            totalSpentCents: paid.reduce((s, o) => s + o.amountCents, 0),
            activeKits: db.entitlements.filter((e) => e.userId === u.id && canDownload(entitlementStatus(e))).length,
            lastOrderAt: orders.map((o) => o.createdAt).sort().pop() ?? null,
          }
        })
        .sort((a, b) => (b.lastOrderAt ?? b.createdAt).localeCompare(a.lastOrderAt ?? a.createdAt))
    }),

  get: (id: string) =>
    mockCall<CustomerDetail>(() => {
      const db = getDb()
      requireAdmin(db)
      const user = db.users.find((u) => u.id === id && u.role === 'customer')
      if (!user) throw new ServiceError('NOT_FOUND', 'Cliente não encontrado.')
      return {
        customer: publicUser(user),
        orders: db.orders
          .filter((o) => o.userId === id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(({ autoApproveAt: _a, ...o }) => ({ ...o, packageTitle: db.packages.find((p) => p.id === o.packageId)?.title ?? '—' })),
        entitlements: db.entitlements
          .filter((e) => e.userId === id)
          .map((e) => {
            const pkg = db.packages.find((p) => p.id === e.packageId)
            return {
              ...e,
              status: entitlementStatus(e),
              package: { id: e.packageId, title: pkg?.title ?? '—', slug: pkg?.slug ?? '', coverUrl: pkg?.coverUrl ?? null },
            }
          }),
        downloadsCount: db.downloads.filter((d) => d.userId === id).length,
      }
    }),

  /** Cadastro manual (ex.: venda feita pelo WhatsApp). Envia a senha temporária por email. */
  create: (input: z.input<typeof newCustomerSchema>) =>
    mockCall(() => {
      const parsed = newCustomerSchema.safeParse(input)
      if (!parsed.success) {
        throw new ServiceError('VALIDATION', 'Revise os campos destacados.', zodDetails(parsed.error))
      }
      return mutate((db) => {
        requireAdmin(db)
        if (db.users.some((u) => u.email === parsed.data.email))
          throw new ServiceError('CONFLICT', 'Já existe um cliente com este email.', { email: 'Email já cadastrado.' })
        const password = generateTempPassword()
        const user = {
          id: newId('usr'),
          email: parsed.data.email,
          name: parsed.data.name,
          phone: parsed.data.phone || null,
          role: 'customer' as const,
          mustChangePassword: true,
          password,
          createdAt: new Date().toISOString(),
        }
        db.users.push(user)
        sendEmail(db, {
          to: user.email,
          subject: 'Sua conta na Festinhas foi criada',
          body: `Olá, ${user.name}! Criamos sua conta na Área do Cliente.\n\nEmail: ${user.email}\nSenha temporária: ${password}`,
          actionUrl: '/conta/login',
          actionLabel: 'Acessar',
        })
        return publicUser(user)
      })
    }),

  grantAccess: (userId: string, packageId: string, accessDays: number | null) =>
    mockCall(() =>
      mutate((db) => {
        requireAdmin(db)
        const user = db.users.find((u) => u.id === userId)
        const pkg = db.packages.find((p) => p.id === packageId)
        if (!user || !pkg) throw new ServiceError('NOT_FOUND', 'Cliente ou pacote não encontrado.')
        grantEntitlement(db, { userId, packageId, orderId: null, accessDays })
        sendEmail(db, {
          to: user.email,
          subject: `Você ganhou acesso ao ${pkg.title}`,
          body: `Olá, ${user.name}! O ${pkg.title} já está disponível na sua Área do Cliente.`,
          actionUrl: '/conta',
          actionLabel: 'Ver meus kits',
        })
      }),
    ),

  revokeAccess: (entitlementId: string) =>
    mockCall(() =>
      mutate((db) => {
        requireAdmin(db)
        const ent = db.entitlements.find((e) => e.id === entitlementId)
        if (!ent) throw new ServiceError('NOT_FOUND', 'Acesso não encontrado.')
        ent.revokedAt = new Date().toISOString()
      }),
    ),

  restoreAccess: (entitlementId: string) =>
    mockCall(() =>
      mutate((db) => {
        requireAdmin(db)
        const ent = db.entitlements.find((e) => e.id === entitlementId)
        if (!ent) throw new ServiceError('NOT_FOUND', 'Acesso não encontrado.')
        ent.revokedAt = null
      }),
    ),

  /** Gera nova senha temporária e reenvia o email de acesso. */
  resendAccess: (userId: string) =>
    mockCall(() =>
      mutate((db) => {
        requireAdmin(db)
        const user = db.users.find((u) => u.id === userId)
        if (!user) throw new ServiceError('NOT_FOUND', 'Cliente não encontrado.')
        const password = generateTempPassword()
        user.password = password
        user.mustChangePassword = true
        sendEmail(db, {
          to: user.email,
          subject: 'Seus dados de acesso',
          body: `Olá, ${user.name}! Aqui estão seus novos dados de acesso.\n\nEmail: ${user.email}\nSenha temporária: ${password}`,
          actionUrl: '/conta/login',
          actionLabel: 'Acessar meus kits',
        })
      }),
    ),
}

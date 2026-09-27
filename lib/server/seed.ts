// Carga dos dados de exemplo. Usada por `npm run db:seed`, pelo "Restaurar dados" da DevToolbar e pelos testes.

import { and, eq, inArray, notInArray, or, sql } from 'drizzle-orm'
import { hashPassword } from './auth/password'
import * as t from './db/schema'
import type { Db } from './db/types'
import { createSeed } from './seed-data'

/**
 * Apaga os dados e recria os de exemplo.
 * - Administradores reais (que não são contas do seed) são SEMPRE preservados.
 * - `kind: 'empty'` recria só os usuários de exemplo (para testar telas vazias continuando logado).
 * - `withFiles: false` (há um bucket R2 de verdade): não cria arquivos fictícios e preserva os arquivos e
 *   pastas já registrados (vêm do bucket); os pacotes de exemplo ficam como rascunho, sem arquivos.
 * - `hash` permite reaproveitar hashes já calculados (os testes usam para ficar rápidos).
 */
export async function seedDatabase(
  db: Db,
  {
    kind = 'seed',
    withFiles = true,
    hash = hashPassword,
  }: { kind?: 'seed' | 'empty'; withFiles?: boolean; hash?: (p: string) => Promise<string> } = {},
) {
  const seed = createSeed()
  const date = (iso: string) => new Date(iso)
  const dateOrNull = (iso: string | null | undefined) => (iso ? new Date(iso) : null)
  const seedEmails = seed.users.map((u) => u.email)

  const users = await Promise.all(
    seed.users.map(async ({ password, createdAt, ...u }) => ({ ...u, passwordHash: await hash(password), createdAt: date(createdAt), updatedAt: date(createdAt) })),
  )

  await db.transaction(async (tx) => {
    const tables = withFiles
      ? sql`downloads, entitlements, orders, package_files, packages, files, folders, email_outbox, login_attempts, password_resets, sessions`
      : sql`downloads, entitlements, orders, package_files, packages, email_outbox, login_attempts, password_resets, sessions`
    await tx.execute(sql`truncate table ${tables} restart identity cascade`)
    // Remove clientes e as contas do seed; mantém os admins reais.
    await tx.delete(t.users).where(or(eq(t.users.role, 'customer'), and(eq(t.users.role, 'admin'), inArray(t.users.email, seedEmails))))
    // Se um email do seed já existir (improvável), não duplica.
    await tx.insert(t.users).values(users).onConflictDoNothing()
    if (kind === 'empty') return

    if (withFiles) {
      await tx.insert(t.folders).values(seed.folders.map((path) => ({ path })))
      await tx.insert(t.files).values(seed.files.map((f) => ({ ...f, createdAt: date(f.createdAt) })))
    }
    await tx.insert(t.packages).values(
      seed.packages.map(({ fileIds: _f, createdAt, updatedAt, ...p }) => ({
        ...p,
        // Sem arquivos o pacote não pode estar no catálogo.
        active: withFiles && p.active,
        createdAt: date(createdAt),
        updatedAt: date(updatedAt),
      })),
    )
    if (withFiles)
      await tx.insert(t.packageFiles).values(seed.packages.flatMap((p) => p.fileIds.map((fileId, position) => ({ packageId: p.id, fileId, position }))))
    await tx
      .insert(t.orders)
      .values(seed.orders.map(({ createdAt, paidAt, ...o }) => ({ ...o, createdAt: date(createdAt), paidAt: dateOrNull(paidAt) })))
    await tx
      .insert(t.entitlements)
      .values(seed.entitlements.map((e) => ({ ...e, createdAt: date(e.createdAt), expiresAt: dateOrNull(e.expiresAt), revokedAt: dateOrNull(e.revokedAt) })))
    if (withFiles) await tx.insert(t.downloads).values(seed.downloads.map((d) => ({ ...d, createdAt: date(d.createdAt) })))
  })
}

/**
 * Deixa o banco "de verdade": apaga clientes, pedidos, acessos, downloads, emails, pacotes e as contas do seed.
 * Mantém os administradores reais e os arquivos/pastas (que refletem o bucket R2).
 */
export async function wipeToRealData(db: Db) {
  const seedEmails = createSeed().users.map((u) => u.email)
  return db.transaction(async (tx) => {
    const realAdmins = await tx
      .select({ id: t.users.id })
      .from(t.users)
      .where(and(eq(t.users.role, 'admin'), notInArray(t.users.email, seedEmails)))
    if (!realAdmins.length) throw new Error('Nenhum administrador real encontrado. Crie um com `npm run admin:create` antes de limpar.')
    await tx.execute(
      sql`truncate table downloads, entitlements, orders, package_files, packages, email_outbox, login_attempts, password_resets, sessions restart identity cascade`,
    )
    const removed = await tx
      .delete(t.users)
      .where(or(eq(t.users.role, 'customer'), inArray(t.users.email, seedEmails)))
      .returning({ id: t.users.id })
    return { realAdmins: realAdmins.length, removedUsers: removed.length }
  })
}

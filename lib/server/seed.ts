// Carga dos dados de exemplo. Usada por `npm run db:seed`, pelo "Restaurar dados" da DevToolbar e pelos testes.

import { createSeed } from './seed-data'
import { sql } from 'drizzle-orm'
import { hashPassword } from './auth/password'
import * as t from './db/schema'
import type { Db } from './db/types'

const ALL_TABLES = sql`downloads, entitlements, orders, package_files, packages, files, folders,
  email_outbox, login_attempts, password_resets, sessions, users`

/**
 * Apaga tudo e recria os dados de exemplo.
 * `kind: 'empty'` recria só os usuários (para testar telas vazias continuando logado).
 * `withFiles: false` não cria os arquivos fictícios (usado quando há um bucket R2 de verdade: os arquivos
 * vêm do bucket via "Sincronizar"); os pacotes de exemplo ficam como rascunho, sem arquivos.
 * `hash` permite reaproveitar hashes já calculados (os testes usam para ficar rápidos).
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

  const users = await Promise.all(
    seed.users.map(async ({ password, createdAt, ...u }) => ({ ...u, passwordHash: await hash(password), createdAt: date(createdAt), updatedAt: date(createdAt) })),
  )

  await db.transaction(async (tx) => {
    await tx.execute(sql`truncate table ${ALL_TABLES} restart identity cascade`)
    await tx.insert(t.users).values(users)
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

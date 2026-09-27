// Suporte à DevToolbar (modo de simulação). As rotas que usam isto só existem com devOnly().

import { ServiceError } from '@/lib/services/errors'
import { asc, desc, eq, sql } from 'drizzle-orm'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { toOutboxEmail, toUser } from '../mappers'
import { seedDatabase } from '../seed'
import { getStorage } from '../storage'
import { createSession } from './auth'

export async function listOutbox(db: Db) {
  return (await db.select().from(t.emailOutbox).orderBy(desc(t.emailOutbox.createdAt)).limit(50)).map(toOutboxEmail)
}

export async function clearOutbox(db: Db) {
  await db.delete(t.emailOutbox)
}

/** Entra como uma conta existente sem senha — só para os atalhos da DevToolbar. */
export async function loginAs(db: Db, email: string) {
  // "admin" = qualquer administrador (o do seed pode não existir mais depois da limpeza).
  const [user] =
    email === 'admin'
      ? await db.select().from(t.users).where(eq(t.users.role, 'admin')).orderBy(asc(t.users.createdAt)).limit(1)
      : await db.select().from(t.users).where(eq(t.users.email, email.trim().toLowerCase()))
  if (!user) throw new ServiceError('NOT_FOUND', 'Conta de teste não encontrada. Restaure os dados de exemplo.')
  const session = await createSession(db, user.id, 'devtoolbar')
  return { ...session, user: toUser(user) }
}

export async function counts(db: Db) {
  const [row] = await db.execute<{ packages: number; files: number; orders: number; customers: number; entitlements: number }>(sql`
    select
      (select count(*)::int from ${t.packages}) as packages,
      (select count(*)::int from ${t.files}) as files,
      (select count(*)::int from ${t.orders}) as orders,
      (select count(*)::int from ${t.users} where role = 'customer') as customers,
      (select count(*)::int from ${t.entitlements}) as entitlements
  `).then((r) => r.rows)
  return row
}

/** Com R2 configurado não cria arquivos fictícios: os arquivos reais vêm do bucket ("Sincronizar"). */
export function resetData(db: Db, kind: 'seed' | 'empty') {
  return seedDatabase(db, { kind, withFiles: getStorage().kind === 'demo' })
}

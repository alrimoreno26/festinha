// Banco de teste: Postgres de verdade rodando em memória (PGlite), com as mesmas migrações
// do projeto e os mesmos dados de exemplo do seed. Cada teste recebe um banco novo.

import { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import path from 'node:path'
import { SEED_ACCOUNTS } from '@/lib/server/seed-data'
import { hashPassword } from '@/lib/server/auth/password'
import * as schema from '@/lib/server/db/schema'
import type { Db } from '@/lib/server/db/types'
import { toUser } from '@/lib/server/mappers'
import { seedDatabase } from '@/lib/server/seed'

const t = schema

// argon2 é propositalmente lento: cada senha do seed é "hasheada" uma vez só por execução.
const hashCache = new Map<string, Promise<string>>()
const cachedHash = (password: string) => {
  if (!hashCache.has(password)) hashCache.set(password, hashPassword(password))
  return hashCache.get(password)!
}

export async function createTestDb(): Promise<Db> {
  const client = new PGlite()
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') })
  return db as unknown as Db
}

/** Banco novo com os dados de exemplo (mesmos do `npm run db:seed`). */
export async function createSeededDb() {
  const db = await createTestDb()
  await seedDatabase(db, { hash: cachedHash })

  const actor = async (id: string) => toUser((await db.select().from(t.users).where(eq(t.users.id, id)))[0])
  return {
    db,
    admin: await actor('usr_admin'),
    maria: await actor('usr_maria'),
    ana: await actor('usr_ana'),
    joao: await actor('usr_joao'),
    accounts: SEED_ACCOUNTS,
  }
}

/** Emails enfileirados para um destinatário (filtre por assunto no teste: `now()` é igual dentro da mesma transação). */
export function emailsTo(db: Db, to: string) {
  return db.select().from(t.emailOutbox).where(eq(t.emailOutbox.to, to))
}

/** Extrai a senha temporária do corpo de um email de acesso. */
export const tempPasswordIn = (body: string) => body.match(/Senha temporária: (\S+)/)?.[1]

export { t }

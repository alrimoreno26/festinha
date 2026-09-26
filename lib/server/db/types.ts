import type { PgDatabase } from 'drizzle-orm/pg-core'
import type * as schema from './schema'

/**
 * Conexão aceita pelas funções de domínio: o banco da Neon em produção, uma transação,
 * ou um Postgres em memória (PGlite) nos testes. Por isso o domínio recebe `db` por parâmetro.
 */
export type Db = PgDatabase<any, typeof schema>

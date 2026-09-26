import 'server-only'

import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import ws from 'ws'
import * as schema from './schema'

// O driver serverless da Neon usa WebSocket; o Pool permite transações.
neonConfig.webSocketConstructor = ws

const globalForDb = globalThis as unknown as { pool?: Pool }

// Reaproveita o pool entre recarregamentos do `next dev`.
const pool = globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL })
if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool

export const db = drizzle(pool, { schema })
export type DB = typeof db

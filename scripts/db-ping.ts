// Testa a conexão com o banco (não imprime credenciais).
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const { rows } = await pool.query('select current_database() as db, version() as version, now() as now')
  console.log({ db: rows[0].db, version: String(rows[0].version).split(' on ')[0], serverTime: rows[0].now })
  await pool.end()
}

main().catch((err) => {
  console.error('Falha ao conectar:', err.message)
  process.exit(1)
})

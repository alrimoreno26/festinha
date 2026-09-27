// Recria os dados de exemplo no banco de DESENVOLVIMENTO (apaga tudo antes).
//
//   npm run db:seed

import { sql } from 'drizzle-orm'
import { db } from '../lib/server/db'
import { seedDatabase } from '../lib/server/seed'
import { getStorage } from '../lib/server/storage'

async function main() {
  if (process.env.VERCEL_ENV || process.env.NODE_ENV === 'production') {
    throw new Error('Seed bloqueado: não rode em produção.')
  }

  const withFiles = getStorage().kind === 'demo'
  console.log(withFiles ? 'Recriando dados de exemplo…' : 'Recriando dados de exemplo sem arquivos fictícios (R2 configurado: use "Sincronizar com o bucket")…')
  await seedDatabase(db, { withFiles })

  const counts = await db.execute<{ table: string; n: number }>(sql`
    select 'users' as table, count(*)::int as n from users
    union all select 'packages', count(*)::int from packages
    union all select 'files', count(*)::int from files
    union all select 'orders', count(*)::int from orders
    union all select 'entitlements', count(*)::int from entitlements
  `)
  console.table(counts.rows)
  console.log('Seed concluído. Contas de teste: ver SEED_ACCOUNTS em lib/server/seed-data.ts')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

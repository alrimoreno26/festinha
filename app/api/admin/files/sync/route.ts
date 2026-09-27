import * as files from '@/lib/server/domain/files'
import { body, db, route } from '@/lib/server/http'
import { z } from 'zod'

/** Reconcilia banco e bucket. Com `prune`, remove os registros cujo arquivo não existe mais no bucket. */
export const POST = route(async ({ req, actor }) => {
  const { prune } = await body(req, z.object({ prune: z.boolean().default(false) }))
  return files.syncFromBucket(db, actor, { prune })
})

// Pode percorrer o bucket inteiro.
export const maxDuration = 60

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

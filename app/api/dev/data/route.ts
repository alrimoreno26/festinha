import * as dev from '@/lib/server/domain/dev'
import { body, db, devOnly, route } from '@/lib/server/http'
import { z } from 'zod'

export const GET = route(async () => {
  devOnly()
  return dev.counts(db)
})

/** Restaura os dados de exemplo ou esvazia (mantendo os usuários). */
export const POST = route(async ({ req }) => {
  devOnly()
  const { kind } = await body(req, z.object({ kind: z.enum(['seed', 'empty']) }))
  await dev.resetData(db, kind)
  return null
})

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

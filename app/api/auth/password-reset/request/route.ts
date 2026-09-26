import * as auth from '@/lib/server/domain/auth'
import { body, db, route } from '@/lib/server/http'
import { z } from 'zod'

const schema = z.object({ email: z.string().max(320) })

export const POST = route(async ({ req }) => {
  await auth.requestPasswordReset(db, (await body(req, schema)).email)
  return null
})

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

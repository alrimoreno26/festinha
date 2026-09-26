import * as auth from '@/lib/server/domain/auth'
import { body, db, route } from '@/lib/server/http'
import { z } from 'zod'

const schema = z.object({ token: z.string().max(200), newPassword: z.string().max(200) })

export const POST = route(async ({ req }) => {
  const { token, newPassword } = await body(req, schema)
  await auth.resetPassword(db, token, newPassword)
  return null
})

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

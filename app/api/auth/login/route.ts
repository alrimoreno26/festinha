import * as auth from '@/lib/server/domain/auth'
import { body, db, route, setSessionCookie } from '@/lib/server/http'
import { z } from 'zod'

const schema = z.object({ email: z.string().max(320), password: z.string().max(200) })

// Sem transação de propósito: a tentativa falha precisa ficar gravada para o limite de tentativas.
export const POST = route(async ({ req }) => {
  const { email, password } = await body(req, schema)
  const { token, expiresAt, user } = await auth.login(db, email, password, req.headers.get('user-agent'))
  setSessionCookie(token, expiresAt)
  return { user }
})

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

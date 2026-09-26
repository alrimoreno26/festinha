import * as auth from '@/lib/server/domain/auth'
import * as dev from '@/lib/server/domain/dev'
import { body, clearSessionCookie, db, devOnly, route, setSessionCookie } from '@/lib/server/http'
import { z } from 'zod'

/** Atalho da DevToolbar: entra como uma conta de teste sem senha (ou sai, com email null). */
export const POST = route(async ({ req, sessionToken }) => {
  devOnly()
  const { email } = await body(req, z.object({ email: z.string().nullable() }))
  if (sessionToken) await auth.logout(db, sessionToken)
  if (!email) {
    clearSessionCookie()
    return null
  }
  const { token, expiresAt, user } = await dev.loginAs(db, email)
  setSessionCookie(token, expiresAt)
  return { user }
})

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

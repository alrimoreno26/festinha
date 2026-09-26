import * as auth from '@/lib/server/domain/auth'
import { clearSessionCookie, db, route } from '@/lib/server/http'

export const POST = route(async ({ sessionToken }) => {
  if (sessionToken) await auth.logout(db, sessionToken)
  clearSessionCookie()
  return null
})

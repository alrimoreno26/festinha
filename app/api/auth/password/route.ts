import * as auth from '@/lib/server/domain/auth'
import { requireUser } from '@/lib/server/guards'
import { body, db, route } from '@/lib/server/http'
import { z } from 'zod'

const schema = z.object({ currentPassword: z.string().nullable(), newPassword: z.string().max(200) })

export const POST = route(async ({ req, actor, sessionToken }) => {
  const user = requireUser(actor)
  const { currentPassword, newPassword } = await body(req, schema)
  await auth.changePassword(db, user, sessionToken!, currentPassword, newPassword)
  return { user: { ...user, mustChangePassword: false } }
})

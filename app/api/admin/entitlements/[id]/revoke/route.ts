import * as customers from '@/lib/server/domain/customers'
import { db, route } from '@/lib/server/http'

export const POST = route<{ id: string }>(async ({ actor, params }) => {
  await customers.revokeAccess(db, actor, params.id)
  return null
})

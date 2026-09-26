import * as customers from '@/lib/server/domain/customers'
import { db, route } from '@/lib/server/http'

export const POST = route<{ id: string }>(async ({ actor, params }) => {
  await customers.restoreAccess(db, actor, params.id)
  return null
})

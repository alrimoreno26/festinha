import * as customers from '@/lib/server/domain/customers'
import { body, db, route } from '@/lib/server/http'
import { z } from 'zod'

const schema = z.object({ packageId: z.string(), accessDays: z.number().int().positive().nullable() })

export const POST = route<{ id: string }>(async ({ req, actor, params }) => {
  const { packageId, accessDays } = await body(req, schema)
  await customers.grantAccess(db, actor, params.id, packageId, accessDays)
  return null
})

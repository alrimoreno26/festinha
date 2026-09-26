import * as packages from '@/lib/server/domain/packages'
import { body, db, route } from '@/lib/server/http'
import { packageInputSchema } from '../../schemas'

type P = { id: string }

export const GET = route<P>(({ actor, params }) => packages.get(db, actor, params.id))
export const PUT = route<P>(async ({ req, actor, params }) => packages.update(db, actor, params.id, await body(req, packageInputSchema)))
export const DELETE = route<P>(async ({ actor, params }) => {
  await packages.remove(db, actor, params.id)
  return null
})

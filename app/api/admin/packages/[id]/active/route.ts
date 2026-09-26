import * as packages from '@/lib/server/domain/packages'
import { body, db, route } from '@/lib/server/http'
import { z } from 'zod'

export const PATCH = route<{ id: string }>(async ({ req, actor, params }) =>
  packages.setActive(db, actor, params.id, (await body(req, z.object({ active: z.boolean() }))).active),
)

import * as auth from '@/lib/server/domain/auth'
import { requireUser } from '@/lib/server/guards'
import { body, db, route } from '@/lib/server/http'
import { z } from 'zod'

const schema = z.object({ name: z.string().max(200), phone: z.string().max(40).nullable() })

export const PATCH = route(async ({ req, actor }) => auth.updateProfile(db, requireUser(actor), await body(req, schema)))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

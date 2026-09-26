import * as packages from '@/lib/server/domain/packages'
import { body, db, route } from '@/lib/server/http'
import { packageInputSchema } from '../schemas'

export const GET = route(({ actor }) => packages.list(db, actor))
export const POST = route(async ({ req, actor }) => packages.create(db, actor, await body(req, packageInputSchema)))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

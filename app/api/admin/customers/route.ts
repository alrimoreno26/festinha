import * as customers from '@/lib/server/domain/customers'
import { body, db, route } from '@/lib/server/http'
import { z } from 'zod'

export const GET = route(({ req, actor }) => customers.list(db, actor, req.nextUrl.searchParams.get('q') ?? ''))

const schema = z.object({ name: z.string().max(200), email: z.string().max(320), phone: z.string().max(40).optional() })

export const POST = route(async ({ req, actor }) => customers.create(db, actor, await body(req, schema)))

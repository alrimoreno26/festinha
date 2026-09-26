import * as customers from '@/lib/server/domain/customers'
import { db, route } from '@/lib/server/http'

export const GET = route<{ id: string }>(({ actor, params }) => customers.get(db, actor, params.id))

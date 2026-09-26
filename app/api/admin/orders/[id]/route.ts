import * as orders from '@/lib/server/domain/orders'
import { db, route } from '@/lib/server/http'

export const GET = route<{ id: string }>(({ actor, params }) => orders.get(db, actor, params.id))

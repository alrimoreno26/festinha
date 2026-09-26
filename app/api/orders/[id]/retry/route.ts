import * as checkout from '@/lib/server/domain/checkout'
import { db, route } from '@/lib/server/http'

export const POST = route<{ id: string }>(({ params }) => checkout.retry(db, params.id))

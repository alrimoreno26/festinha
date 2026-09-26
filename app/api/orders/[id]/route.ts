import * as checkout from '@/lib/server/domain/checkout'
import { db, route } from '@/lib/server/http'

/** Status público do pedido (página de retorno). */
export const GET = route<{ id: string }>(({ params }) => checkout.getOrder(db, params.id))

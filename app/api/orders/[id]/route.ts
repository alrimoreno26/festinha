import * as checkout from '@/lib/server/domain/checkout'
import { db, route } from '@/lib/server/http'

/** Status público do pedido (página de retorno). */
export const GET = route<{ id: string }>(({ params }) => checkout.getOrder(db, params.id))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

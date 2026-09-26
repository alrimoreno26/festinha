import * as orders from '@/lib/server/domain/orders'
import { db, route } from '@/lib/server/http'

export const POST = route<{ id: string }>(async ({ actor, params }) => {
  await orders.refund(db, actor, params.id)
  return null
})

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

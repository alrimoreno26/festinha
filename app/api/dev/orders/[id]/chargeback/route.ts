import * as orders from '@/lib/server/domain/orders'
import { db, devOnly, route } from '@/lib/server/http'

export const POST = route<{ id: string }>(async ({ actor, params }) => {
  devOnly()
  await orders.simulateChargeback(db, actor, params.id)
  return null
})

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

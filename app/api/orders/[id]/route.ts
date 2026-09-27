import * as checkout from '@/lib/server/domain/checkout'
import { db, route } from '@/lib/server/http'

/**
 * Status público do pedido (página de retorno). O Mercado Pago devolve o cliente com
 * ?payment_id=… (ou collection_id): consultamos na hora para não depender só do webhook.
 */
export const GET = route<{ id: string }>(({ req, params }) => {
  const q = req.nextUrl.searchParams
  return checkout.getOrder(db, params.id, { paymentId: q.get('payment_id') ?? q.get('collection_id') })
})

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

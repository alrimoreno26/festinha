import * as checkout from '@/lib/server/domain/checkout'
import { body, db, devOnly, route } from '@/lib/server/http'
import { z } from 'zod'

const schema = z.object({
  method: z.enum(['pix', 'card']),
  outcome: z.enum(['approved', 'pending', 'rejected']),
  pixAutoConfirmSeconds: z.number().int().min(0).max(3600),
})

/** Faz o papel do Mercado Pago no simulador de pagamento. */
export const POST = route<{ orderId: string }>(async ({ req, params }) => {
  devOnly()
  const { method, ...opts } = await body(req, schema)
  return checkout.simulatePayment(db, params.orderId, method, opts)
})

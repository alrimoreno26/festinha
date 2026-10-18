import * as checkout from '@/lib/server/domain/checkout'
import { body, db, publicUrls, route } from '@/lib/server/http'
import { z } from 'zod'

// A validação detalhada (mensagens por campo) fica no domínio.
const schema = z.object({
  packageSlug: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  customization: z.record(z.string().max(2000)).optional(),
  deliveryMethod: z.enum(['download', 'pickup', 'shipping']).optional(),
  shippingAddress: z.record(z.string().max(200)).optional(),
  shippingServiceId: z.number().int().optional(),
  variantId: z.string().max(40).optional(),
  quantity: z.number().int().optional(),
  uploads: z
    .array(z.object({ id: z.string().max(40), token: z.string().max(100) }))
    .max(5)
    .optional(),
})

/** Cria o pedido e, com Mercado Pago, a preferência de pagamento (devolve o link do checkout). */
export const POST = route(async ({ req }) => checkout.createOrder(db, await body(req, schema), publicUrls(req)))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

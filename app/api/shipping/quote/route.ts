import * as shipping from '@/lib/server/domain/shipping'
import { body, db, route } from '@/lib/server/http'
import { z } from 'zod'

const schema = z.object({ packageSlug: z.string().max(200), postalCode: z.string().max(20), variantId: z.string().max(40).optional() })

/** Cotação de frete (Melhor Envio) para um pacote impresso até o CEP informado. Não grava nada. */
export const POST = route(async ({ req }) => {
  const { packageSlug, postalCode, variantId } = await body(req, schema)
  return shipping.quoteBySlug(db, packageSlug, postalCode, undefined, variantId)
})

// Depende do banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

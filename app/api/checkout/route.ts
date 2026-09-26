import * as checkout from '@/lib/server/domain/checkout'
import { body, db, route } from '@/lib/server/http'
import { z } from 'zod'

// A validação detalhada (mensagens por campo) fica no domínio.
const schema = z.object({ packageSlug: z.string(), name: z.string(), email: z.string(), phone: z.string() })

export const POST = route(async ({ req }) => checkout.createOrder(db, await body(req, schema)))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

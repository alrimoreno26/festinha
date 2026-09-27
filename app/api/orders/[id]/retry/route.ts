import * as checkout from '@/lib/server/domain/checkout'
import { db, publicUrls, route } from '@/lib/server/http'

export const POST = route<{ id: string }>(({ req, params }) => checkout.retry(db, params.id, publicUrls(req)))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

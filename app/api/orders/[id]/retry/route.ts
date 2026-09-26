import * as checkout from '@/lib/server/domain/checkout'
import { db, route } from '@/lib/server/http'

export const POST = route<{ id: string }>(({ params }) => checkout.retry(db, params.id))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

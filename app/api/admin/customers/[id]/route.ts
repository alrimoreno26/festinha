import * as customers from '@/lib/server/domain/customers'
import { db, route } from '@/lib/server/http'

export const GET = route<{ id: string }>(({ actor, params }) => customers.get(db, actor, params.id))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

import { route } from '@/lib/server/http'

export const GET = route(async ({ actor }) => (actor ? { user: actor } : null))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

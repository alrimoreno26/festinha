import * as packages from '@/lib/server/domain/packages'
import { db, route } from '@/lib/server/http'

export const GET = route(() => packages.listPublic(db))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

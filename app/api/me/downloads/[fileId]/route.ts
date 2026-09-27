import * as account from '@/lib/server/domain/account'
import { db, route } from '@/lib/server/http'

/** Autoriza, registra e devolve uma URL assinada do R2 (válida por ~5 min). */
export const POST = route<{ fileId: string }>(({ actor, params }) => account.downloadLink(db, actor, params.fileId))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

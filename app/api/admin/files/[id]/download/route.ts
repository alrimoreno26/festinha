import * as orders from '@/lib/server/domain/orders'
import { db, route } from '@/lib/server/http'

/** URL assinada (vale poucos minutos) para o admin baixar um arquivo, ex.: o logo enviado pelo cliente. */
export const POST = route<{ id: string }>(({ actor, params }) => orders.adminDownloadLink(db, actor, params.id))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

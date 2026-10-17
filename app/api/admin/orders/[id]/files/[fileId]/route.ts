import * as orders from '@/lib/server/domain/orders'
import { db, route } from '@/lib/server/http'

/** Tira um arquivo do pedido (o arquivo continua no explorador). */
export const DELETE = route<{ id: string; fileId: string }>(({ actor, params }) => orders.detachFile(db, actor, params.id, params.fileId))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

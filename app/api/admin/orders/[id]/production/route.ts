import { productionUpdateSchema } from '@/lib/contracts'
import * as orders from '@/lib/server/domain/orders'
import { body, db, route } from '@/lib/server/http'

/** Avança a produção de um pedido sob encomenda (e anexa os arquivos finais do personalizado digital). */
export const PATCH = route<{ id: string }>(async ({ req, actor, params }) =>
  orders.updateProduction(db, actor, params.id, await body(req, productionUpdateSchema)),
)

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

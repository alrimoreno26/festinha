import * as payments from '@/lib/server/domain/payments'
import { db, route } from '@/lib/server/http'

/** "Verificar no Mercado Pago": consulta os pagamentos deste pedido e aplica o estado atual. */
export const POST = route<{ id: string }>(({ actor, params }) => payments.checkOrder(db, actor, params.id))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

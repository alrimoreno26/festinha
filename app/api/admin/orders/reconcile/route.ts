import * as payments from '@/lib/server/domain/payments'
import { db, route } from '@/lib/server/http'

/** Revisa no Mercado Pago todos os pedidos pendentes recentes. */
export const POST = route(({ actor }) => payments.reconcilePendingAsAdmin(db, actor))

export const maxDuration = 60

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

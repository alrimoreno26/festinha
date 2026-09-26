import * as orders from '@/lib/server/domain/orders'
import { db, route } from '@/lib/server/http'
import type { OrderFilters } from '@/lib/contracts'

export const GET = route(({ req, actor }) => {
  const q = req.nextUrl.searchParams
  const filters: OrderFilters = {
    status: (q.get('status') as OrderFilters['status']) ?? undefined,
    search: q.get('q') ?? undefined,
    days: Number(q.get('dias')) || undefined,
  }
  return orders.list(db, actor, filters)
})

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

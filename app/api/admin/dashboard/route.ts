import * as dashboard from '@/lib/server/domain/dashboard'
import { db, route } from '@/lib/server/http'

export const GET = route(({ req, actor }) => {
  const days = Number(req.nextUrl.searchParams.get('dias'))
  return dashboard.stats(db, actor, [7, 30, 90].includes(days) ? days : 30)
})

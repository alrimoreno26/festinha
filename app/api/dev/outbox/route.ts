import * as dev from '@/lib/server/domain/dev'
import { db, devOnly, route } from '@/lib/server/http'

export const GET = route(async () => {
  devOnly()
  return dev.listOutbox(db)
})

export const DELETE = route(async () => {
  devOnly()
  await dev.clearOutbox(db)
  return null
})

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

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

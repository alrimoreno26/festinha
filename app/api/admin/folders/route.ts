import * as files from '@/lib/server/domain/files'
import { body, db, route } from '@/lib/server/http'
import { z } from 'zod'

export const POST = route(async ({ req, actor }) => {
  const { parent, name } = await body(req, z.object({ parent: z.string().max(500), name: z.string().max(100) }))
  return { path: await files.createFolder(db, actor, parent, name) }
})

export const DELETE = route(async ({ req, actor }) => {
  await files.removeFolder(db, actor, req.nextUrl.searchParams.get('pasta') ?? '')
  return null
})

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

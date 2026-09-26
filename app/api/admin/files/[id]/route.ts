import * as files from '@/lib/server/domain/files'
import { body, db, route } from '@/lib/server/http'
import { z } from 'zod'

type P = { id: string }

export const PATCH = route<P>(async ({ req, actor, params }) =>
  files.rename(db, actor, params.id, (await body(req, z.object({ filename: z.string().max(255) }))).filename),
)
export const DELETE = route<P>(async ({ req, actor, params }) => {
  await files.remove(db, actor, params.id, { force: req.nextUrl.searchParams.get('force') === '1' })
  return null
})

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

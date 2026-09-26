import * as files from '@/lib/server/domain/files'
import { body, db, route } from '@/lib/server/http'
import { z } from 'zod'

/** ?pasta=kits/safari → conteúdo da pasta; ?todos=1 → lista plana (seletor de arquivos do pacote). */
export const GET = route(({ req, actor }) =>
  req.nextUrl.searchParams.get('todos') ? files.listAll(db, actor) : files.listFolder(db, actor, req.nextUrl.searchParams.get('pasta') ?? ''),
)

const uploadSchema = z.object({ folder: z.string().max(500), filename: z.string().min(1).max(255), size: z.number(), mime: z.string().max(200) })

/** Registra um arquivo enviado (fase 3: depois do PUT direto no R2). */
export const POST = route(async ({ req, actor }) => files.registerUpload(db, actor, await body(req, uploadSchema)))

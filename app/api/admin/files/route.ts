import * as files from '@/lib/server/domain/files'
import { body, db, route } from '@/lib/server/http'
import { z } from 'zod'

/** ?pasta=kits/safari → conteúdo da pasta; ?todos=1 → lista plana (seletor de arquivos do pacote). */
export const GET = route(({ req, actor }) =>
  req.nextUrl.searchParams.get('todos') ? files.listAll(db, actor) : files.listFolder(db, actor, req.nextUrl.searchParams.get('pasta') ?? ''),
)

const uploadSchema = z.object({ folder: z.string().max(500), filename: z.string().min(1).max(255), size: z.number(), mime: z.string().max(200) })

/** 2º passo do upload: registra o arquivo depois do PUT no R2 (o servidor confere o objeto). */
export const POST = route(async ({ req, actor }) => files.registerUpload(db, actor, await body(req, uploadSchema)))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

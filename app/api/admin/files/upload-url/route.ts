import * as files from '@/lib/server/domain/files'
import { body, db, route } from '@/lib/server/http'
import { z } from 'zod'

const schema = z.object({ folder: z.string().max(500), filename: z.string().min(1).max(255), size: z.number(), mime: z.string().max(200) })

/** 1º passo do upload: URL assinada para o navegador enviar direto ao R2. */
export const POST = route(async ({ req, actor }) => files.prepareUpload(db, actor, await body(req, schema)))

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

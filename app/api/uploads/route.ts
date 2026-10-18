import * as uploads from '@/lib/server/domain/uploads'
import { body, clientIp, db, route } from '@/lib/server/http'
import { z } from 'zod'

const schema = z.object({ filename: z.string().max(300), size: z.number(), mime: z.string().max(100) })

/** Checkout: prepara o envio de um arquivo do cliente (ex.: logo) direto para o bucket. Devolve URL assinada + token. */
export const POST = route(async ({ req }) => uploads.createUpload(db, await body(req, schema), clientIp(req)))

// Depende do banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

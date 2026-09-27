import * as files from '@/lib/server/domain/files'
import { db, route } from '@/lib/server/http'

/** Registra no banco os objetos que já estão no bucket. */
export const POST = route(({ actor }) => files.syncFromBucket(db, actor))

// Pode percorrer o bucket inteiro.
export const maxDuration = 60

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

import { devOnly, route } from '@/lib/server/http'
import { getStorage, r2Config } from '@/lib/server/storage'

/**
 * Diagnóstico do R2 (só no modo de simulação): confere o formato das credenciais sem revelá-las
 * e tenta listar o bucket, devolvendo o erro exato se falhar.
 */
export const GET = route(async () => {
  devOnly()
  const cfg = r2Config()
  const raw = (name: string) => process.env[name] ?? ''
  const shape = (name: string, value: string | undefined, expectedLength?: number) => ({
    defined: !!value,
    length: value?.length ?? 0,
    ...(expectedLength ? { expectedLength } : {}),
    // Sinais de valor colado com aspas/espaços (já tolerados pelo código, mas vale corrigir na Vercel).
    rawHadQuotesOrSpaces: raw(name) !== raw(name).trim() || /^["']|["']$/.test(raw(name).trim()),
  })

  const credentials = {
    R2_ACCOUNT_ID: { ...shape('R2_ACCOUNT_ID', cfg.accountId, 32), looksHex: /^[0-9a-f]{32}$/.test(cfg.accountId ?? '') },
    R2_ACCESS_KEY_ID: shape('R2_ACCESS_KEY_ID', cfg.accessKeyId, 32),
    R2_SECRET_ACCESS_KEY: shape('R2_SECRET_ACCESS_KEY', cfg.secretAccessKey, 64),
    R2_BUCKET: { ...shape('R2_BUCKET', cfg.bucket), value: cfg.bucket ?? null },
  }

  const storage = getStorage()
  let list: unknown
  try {
    let count = 0
    for await (const _ of storage.list()) if (++count >= 1000) break
    list = { ok: true, objects: count }
  } catch (err) {
    const e = err as { name?: string; message?: string; Code?: string; $metadata?: { httpStatusCode?: number } }
    list = { ok: false, name: e.name, code: e.Code, httpStatus: e.$metadata?.httpStatusCode, message: e.message }
  }

  return { driver: storage.kind, runtime: { node: process.version, region: process.env.VERCEL_REGION ?? null }, credentials, list }
})

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

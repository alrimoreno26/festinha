// Armazenamento dos arquivos dos kits.
// - "r2": Cloudflare R2 (API compatível com S3), com URLs assinadas para upload e download.
// - "demo": sem credenciais (testes, ambiente local sem R2) — nada é gravado; downloads são um .txt.

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const UPLOAD_URL_TTL_S = 10 * 60
const DOWNLOAD_URL_TTL_S = 5 * 60

export interface StoredObject {
  key: string
  size: number
  contentType?: string
}

export interface Storage {
  kind: 'r2' | 'demo'
  bucket: string | null
  /** URL para o navegador fazer PUT direto. `null` no modo demo (o upload é simulado). */
  presignUpload(key: string, contentType: string, size: number): Promise<{ url: string; headers: Record<string, string> } | null>
  /** Metadados do objeto; `null` se não existir. */
  head(key: string): Promise<StoredObject | null>
  presignDownload(key: string, filename: string, contentType: string): Promise<string>
  delete(key: string): Promise<void>
  /** Todos os objetos do bucket (paginado internamente). */
  list(): AsyncIterable<StoredObject>
}

/** Content-Disposition com nome seguro em ASCII + versão UTF-8 (RFC 6266). */
function attachment(filename: string) {
  const ascii = filename.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'arquivo'
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

function r2Storage(accountId: string, accessKeyId: string, secretAccessKey: string, bucket: string): Storage {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })

  return {
    kind: 'r2',
    bucket,
    async presignUpload(key, contentType, size) {
      // ContentLength entra na assinatura: o R2 recusa um corpo de tamanho diferente do declarado.
      const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size }), {
        expiresIn: UPLOAD_URL_TTL_S,
      })
      return { url, headers: { 'content-type': contentType } }
    },
    async head(key) {
      try {
        const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
        return { key, size: res.ContentLength ?? 0, contentType: res.ContentType }
      } catch (err) {
        const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        if (status === 404) return null
        throw err
      }
    },
    presignDownload(key, filename, contentType) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: attachment(filename), ResponseContentType: contentType }),
        { expiresIn: DOWNLOAD_URL_TTL_S },
      )
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    },
    async *list() {
      let token: string | undefined
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }))
        for (const obj of page.Contents ?? []) if (obj.Key) yield { key: obj.Key, size: obj.Size ?? 0 }
        token = page.IsTruncated ? page.NextContinuationToken : undefined
      } while (token)
    },
  }
}

export const demoStorage: Storage = {
  kind: 'demo',
  bucket: null,
  presignUpload: async () => null,
  head: async () => null,
  async presignDownload(key, filename) {
    const text = `Arquivo de demonstração — Festinhas\n\n${filename}\n${key}\n\nConfigure o R2 (R2_* no .env) para baixar o arquivo real.`
    return `data:text/plain;charset=utf-8;base64,${Buffer.from(text).toString('base64')}`
  },
  delete: async () => {},
  async *list() {},
}

let cached: Storage | null = null

/** Storage configurado pelas variáveis R2_*; sem elas, modo demo. */
export function getStorage(): Storage {
  if (cached) return cached
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
  cached =
    R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET
      ? r2Storage(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)
      : demoStorage
  return cached
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  psd: 'image/vnd.adobe.photoshop',
  ai: 'application/postscript',
  eps: 'application/postscript',
  cdr: 'application/vnd.corel-draw',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
}

export function mimeFromKey(key: string) {
  return MIME_BY_EXT[key.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'
}

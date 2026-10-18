// Arquivos que o cliente envia no checkout (ex.: o logo da empresa para os cartões).
//
// Não há login nesse momento, então:
//  - só imagens e PDF, até 15 MB, direto para o bucket com URL assinada (o arquivo não passa pelo servidor);
//  - limite de envios por IP;
//  - o navegador recebe um token de uso único; o pedido só aceita o upload com o token certo;
//  - envios que não viram pedido são apagados pelo cron depois de alguns dias.

import { CUSTOMER_UPLOAD_TYPES, MAX_CUSTOMER_UPLOAD_BYTES, MAX_CUSTOMER_UPLOADS, type CustomerUploadTicket } from '@/lib/contracts'
import { ServiceError } from '@/lib/services/errors'
import { and, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { newId, newToken, sha256 } from '../ids'
import { getStorage, type Storage } from '../storage'
import { sanitizeName } from './files'

const HOUR = 60 * 60 * 1000
const MAX_PER_IP_PER_HOUR = 20
/** Depois disso o upload não pode mais ser usado num pedido (e o cron apaga). */
const UPLOAD_TTL_MS = 3 * 24 * HOUR

export async function createUpload(
  db: Db,
  input: { filename: string; size: number; mime: string },
  ip: string,
  storage: Storage = getStorage(),
): Promise<CustomerUploadTicket> {
  const mime = input.mime.toLowerCase()
  if (!CUSTOMER_UPLOAD_TYPES.includes(mime)) throw new ServiceError('VALIDATION', 'Envie uma imagem (PNG, JPG, WEBP ou SVG) ou um PDF.')
  if (!Number.isInteger(input.size) || input.size <= 0) throw new ServiceError('VALIDATION', 'Arquivo inválido.')
  if (input.size > MAX_CUSTOMER_UPLOAD_BYTES) throw new ServiceError('VALIDATION', 'O arquivo pode ter até 15 MB.')

  const ipHash = await sha256(ip || 'desconhecido')
  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(t.customerUploads)
    .where(and(eq(t.customerUploads.ipHash, ipHash), gte(t.customerUploads.createdAt, new Date(Date.now() - HOUR))))
  if (recent >= MAX_PER_IP_PER_HOUR) throw new ServiceError('RATE_LIMITED', 'Muitos envios seguidos. Aguarde um pouco e tente de novo.')

  const id = newId('upl')
  const token = newToken()
  const month = new Date().toISOString().slice(0, 7)
  const filename = input.filename.trim().slice(0, 120) || 'arquivo'
  const key = `clientes/envios/${month}/${id}-${sanitizeName(filename) || 'arquivo'}`
  await db.insert(t.customerUploads).values({ id, tokenHash: await sha256(token), key, filename, size: input.size, mime, ipHash })
  const signed = await storage.presignUpload(key, mime, input.size)
  return { id, token, uploadUrl: signed?.url ?? null, headers: signed?.headers ?? {} }
}

/**
 * Liga os uploads ao pedido (dentro da transação de criação). Confere o token, a validade e,
 * com R2, se o arquivo chegou mesmo ao bucket. Cada upload vira um arquivo do pedido (papel "customer").
 */
export async function attachUploads(db: Db, orderId: string, uploads: { id: string; token: string }[], storage: Storage = getStorage()) {
  if (!uploads.length) return
  if (uploads.length > MAX_CUSTOMER_UPLOADS) throw new ServiceError('VALIDATION', 'Envie no máximo 5 arquivos.', { uploads: 'Envie no máximo 5 arquivos.' })
  const rows = await db
    .select()
    .from(t.customerUploads)
    .where(inArray(t.customerUploads.id, uploads.map((u) => u.id)))
    .for('update')

  const invalid = () => new ServiceError('VALIDATION', 'Um dos arquivos enviados expirou. Envie o logo de novo.', { uploads: 'Envie o arquivo de novo.' })
  for (const [position, up] of uploads.entries()) {
    const row = rows.find((r) => r.id === up.id)
    if (!row || row.orderId || row.tokenHash !== (await sha256(up.token)) || row.createdAt.getTime() < Date.now() - UPLOAD_TTL_MS) throw invalid()
    let size = row.size
    if (storage.kind !== 'demo') {
      const obj = await storage.head(row.key)
      if (!obj) throw new ServiceError('VALIDATION', 'Um dos arquivos não terminou de enviar. Envie de novo.', { uploads: 'Envie o arquivo de novo.' })
      size = obj.size
    }
    const fileId = newId('fil')
    await db.insert(t.files).values({ id: fileId, key: row.key, filename: row.filename, size, mime: row.mime })
    await db.insert(t.orderFiles).values({ orderId, fileId, position, role: 'customer' })
    await db.update(t.customerUploads).set({ orderId, fileId }).where(eq(t.customerUploads.id, row.id))
  }
}

/** Apaga (bucket + banco) os envios que nunca viraram pedido. Chamado pelo cron. */
export async function cleanupStaleUploads(db: Db, storage: Storage = getStorage()) {
  const stale = await db
    .select()
    .from(t.customerUploads)
    .where(and(isNull(t.customerUploads.orderId), lt(t.customerUploads.createdAt, new Date(Date.now() - UPLOAD_TTL_MS))))
    .limit(200)
  let removed = 0
  for (const row of stale) {
    try {
      await storage.delete(row.key)
      await db.delete(t.customerUploads).where(eq(t.customerUploads.id, row.id))
      removed++
    } catch (err) {
      console.error('[uploads] falha ao apagar envio antigo', row.key, err)
    }
  }
  return { removed }
}

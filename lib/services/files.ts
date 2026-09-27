import { MAX_UPLOAD_BYTES, type FolderListing, type SyncResult, type UploadTicket } from '@/lib/contracts'
import type { FileItem } from '@/lib/types'
import { ServiceError } from './errors'
import { api, qs } from './http'

export { MAX_UPLOAD_BYTES } from '@/lib/contracts'
export type { FolderListing, SyncResult } from '@/lib/contracts'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** PUT direto no bucket com progresso real (fetch não informa progresso de envio). */
function putWithProgress(url: string, file: File, headers: Record<string, string>, onProgress?: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)))
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ServiceError('NETWORK', `O armazenamento recusou o envio (HTTP ${xhr.status}). Tente de novo.`))
    // Status 0: bloqueado antes de chegar (sem internet ou CORS do bucket não configurado).
    xhr.onerror = () => reject(new ServiceError('NETWORK', 'Não foi possível enviar ao armazenamento. Verifique a conexão (ou o CORS do bucket).'))
    xhr.send(file)
  })
}

export const filesService = {
  listFolder: (path: string) => api<FolderListing>('GET', `/api/admin/files${qs({ pasta: path })}`),

  /** Lista plana, usada no seletor de arquivos do pacote. */
  listAll: () => api<FileItem[]>('GET', '/api/admin/files?todos=1'),

  createFolder: async (parent: string, name: string) => (await api<{ path: string }>('POST', '/api/admin/folders', { parent, name })).path,

  removeFolder: (path: string) => api<null>('DELETE', `/api/admin/folders${qs({ pasta: path })}`),

  /** Pede URL assinada → envia direto ao R2 → o servidor confere o objeto e registra. */
  upload: async (file: File, folder: string, onProgress?: (percent: number) => void): Promise<FileItem> => {
    if (file.size > MAX_UPLOAD_BYTES) throw new ServiceError('VALIDATION', 'Arquivo maior que 500 MB.')
    const meta = { folder, filename: file.name, size: file.size, mime: file.type || 'application/octet-stream' }
    const ticket = await api<UploadTicket>('POST', '/api/admin/files/upload-url', meta)

    if (ticket.uploadUrl) {
      await putWithProgress(ticket.uploadUrl, file, ticket.headers, onProgress)
    } else {
      // Modo demonstração (sem R2): progresso simulado, só os metadados são registrados.
      for (let i = 1; i < 10; i++) {
        await sleep(40)
        onProgress?.(i * 9)
      }
    }
    const item = await api<FileItem>('POST', '/api/admin/files', meta)
    onProgress?.(100)
    return item
  },

  /** Registra no banco o que já está no bucket (ex.: enviado pelo painel da Cloudflare). */
  syncFromBucket: () => api<SyncResult>('POST', '/api/admin/files/sync'),

  /** Muda o nome exibido e baixado pelo cliente (o objeto no bucket não é movido). */
  rename: (id: string, filename: string) => api<FileItem>('PATCH', `/api/admin/files/${id}`, { filename }),

  /** Arquivos usados em pacotes só são removidos com `force`, que também os tira dos pacotes. */
  remove: (id: string, { force = false } = {}) => api<null>('DELETE', `/api/admin/files/${id}${force ? '?force=1' : ''}`),
}

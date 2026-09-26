import { MAX_UPLOAD_BYTES, type FolderListing } from '@/lib/contracts'
import type { FileItem } from '@/lib/types'
import { ServiceError } from './errors'
import { api, qs } from './http'

export { MAX_UPLOAD_BYTES } from '@/lib/contracts'
export type { FolderListing } from '@/lib/contracts'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const filesService = {
  listFolder: (path: string) => api<FolderListing>('GET', `/api/admin/files${qs({ pasta: path })}`),

  /** Lista plana, usada no seletor de arquivos do pacote. */
  listAll: () => api<FileItem[]>('GET', '/api/admin/files?todos=1'),

  createFolder: async (parent: string, name: string) => (await api<{ path: string }>('POST', '/api/admin/folders', { parent, name })).path,

  removeFolder: (path: string) => api<null>('DELETE', `/api/admin/folders${qs({ pasta: path })}`),

  /**
   * Fase 3: pede uma URL assinada, faz PUT direto no R2 (com progresso real) e registra.
   * Até lá o progresso é simulado e só os metadados são registrados.
   */
  upload: async (file: File, folder: string, onProgress?: (percent: number) => void): Promise<FileItem> => {
    if (file.size > MAX_UPLOAD_BYTES) throw new ServiceError('VALIDATION', 'Arquivo maior que 500 MB.')
    const steps = Math.min(20, Math.max(5, Math.round(file.size / 1_000_000)))
    for (let i = 1; i < steps; i++) {
      await sleep(50)
      onProgress?.(Math.round((i / steps) * 90))
    }
    const item = await api<FileItem>('POST', '/api/admin/files', { folder, filename: file.name, size: file.size, mime: file.type })
    onProgress?.(100)
    return item
  },

  rename: (id: string, filename: string) => api<FileItem>('PATCH', `/api/admin/files/${id}`, { filename }),

  /** Arquivos usados em pacotes só são removidos com `force`, que também os tira dos pacotes. */
  remove: (id: string, { force = false } = {}) => api<null>('DELETE', `/api/admin/files/${id}${force ? '?force=1' : ''}`),
}

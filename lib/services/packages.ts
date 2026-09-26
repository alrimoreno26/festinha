import type { AdminPackageRow, PackageInput, PublicPackage } from '@/lib/contracts'
import type { Package } from '@/lib/types'
import { ServiceError } from './errors'
import { api } from './http'

export type { AdminPackageRow, PackageInput, PublicFile, PublicPackage } from '@/lib/contracts'

export const packagesService = {
  // ---- Público ----
  listPublic: () => api<PublicPackage[]>('GET', '/api/packages'),
  getPublicBySlug: (slug: string) => api<PublicPackage>('GET', `/api/packages/${encodeURIComponent(slug)}`),

  // ---- Admin ----
  list: () => api<AdminPackageRow[]>('GET', '/api/admin/packages'),
  get: (id: string) => api<Package>('GET', `/api/admin/packages/${id}`),
  create: (input: PackageInput) => api<Package>('POST', '/api/admin/packages', input),
  update: (id: string, input: PackageInput) => api<Package>('PUT', `/api/admin/packages/${id}`, input),
  setActive: (id: string, active: boolean) => api<Package>('PATCH', `/api/admin/packages/${id}/active`, { active }),
  /** Só permite excluir pacotes sem vendas; os demais devem ser desativados. */
  remove: (id: string) => api<null>('DELETE', `/api/admin/packages/${id}`),

  /** Fase 3: a capa vai para o R2. Até lá vira uma data URL reduzida, salva junto com o pacote. */
  uploadCover: async (file: File) => {
    if (!file.type.startsWith('image/')) throw new ServiceError('VALIDATION', 'A capa precisa ser uma imagem.')
    return { url: await resizeToDataUrl(file, 800) }
  },
}

function resizeToDataUrl(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => reject(new ServiceError('VALIDATION', 'Não foi possível ler a imagem.'))
    img.src = URL.createObjectURL(file)
  })
}

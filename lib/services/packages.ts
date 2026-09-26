import { slugify } from '@/lib/format'
import { mockCall } from '@/lib/mock/call'
import { requireAdmin } from '@/lib/mock/session'
import { getDb, mutate, newId, type MockDB } from '@/lib/mock/store'
import type { FileItem, Package } from '@/lib/types'
import { ServiceError } from './errors'

export type PackageInput = Pick<
  Package,
  'title' | 'slug' | 'description' | 'coverUrl' | 'priceCents' | 'active' | 'accessDays' | 'fileIds'
>

/** O que o catálogo público vê de cada arquivo: só nome, tipo e tamanho (nunca a key do bucket). */
export type PublicFile = Pick<FileItem, 'filename' | 'mime' | 'size'>

export interface PublicPackage extends Omit<Package, 'fileIds' | 'active'> {
  files: PublicFile[]
}

export interface AdminPackageRow extends Package {
  salesCount: number
  revenueCents: number
}

function toPublic(db: MockDB, pkg: Package): PublicPackage {
  const { fileIds, active: _active, ...rest } = pkg
  return {
    ...rest,
    files: fileIds
      .map((id) => db.files.find((f) => f.id === id))
      .filter((f): f is FileItem => !!f)
      .map(({ filename, mime, size }) => ({ filename, mime, size })),
  }
}

function validate(db: MockDB, input: PackageInput, id?: string): PackageInput {
  const errors: Record<string, string> = {}
  const title = input.title.trim()
  const slug = slugify(input.slug || title)
  if (!title) errors.title = 'Informe o título.'
  if (!slug) errors.slug = 'Informe o slug.'
  else if (db.packages.some((p) => p.slug === slug && p.id !== id)) errors.slug = 'Já existe um pacote com este slug.'
  if (!Number.isInteger(input.priceCents) || input.priceCents < 100) errors.priceCents = 'O preço mínimo é R$ 1,00.'
  if (input.accessDays !== null && (!Number.isInteger(input.accessDays) || input.accessDays < 1))
    errors.accessDays = 'Informe um número de dias válido.'
  if (input.active && input.fileIds.length === 0) errors.fileIds = 'Um pacote ativo precisa ter pelo menos um arquivo.'
  if (Object.keys(errors).length) throw new ServiceError('VALIDATION', 'Revise os campos destacados.', errors)
  return { ...input, title, slug, description: input.description.trim() }
}

export const packagesService = {
  // ---- Público ----
  listPublic: () =>
    mockCall(() => {
      const db = getDb()
      return db.packages.filter((p) => p.active).map((p) => toPublic(db, p))
    }),

  getPublicBySlug: (slug: string) =>
    mockCall(() => {
      const db = getDb()
      const pkg = db.packages.find((p) => p.slug === slug && p.active)
      if (!pkg) throw new ServiceError('NOT_FOUND', 'Pacote não encontrado.')
      return toPublic(db, pkg)
    }),

  // ---- Admin ----
  list: () =>
    mockCall<AdminPackageRow[]>(() => {
      const db = getDb()
      requireAdmin(db)
      return db.packages.map((p) => {
        const paid = db.orders.filter((o) => o.packageId === p.id && o.status === 'approved')
        return { ...p, salesCount: paid.length, revenueCents: paid.reduce((sum, o) => sum + o.amountCents, 0) }
      })
    }),

  get: (id: string) =>
    mockCall(() => {
      const db = getDb()
      requireAdmin(db)
      const pkg = db.packages.find((p) => p.id === id)
      if (!pkg) throw new ServiceError('NOT_FOUND', 'Pacote não encontrado.')
      return pkg
    }),

  create: (input: PackageInput) =>
    mockCall(() =>
      mutate((db) => {
        requireAdmin(db)
        const now = new Date().toISOString()
        const pkg: Package = { ...validate(db, input), id: newId('pkg'), createdAt: now, updatedAt: now }
        db.packages.push(pkg)
        return pkg
      }),
    ),

  update: (id: string, input: PackageInput) =>
    mockCall(() =>
      mutate((db) => {
        requireAdmin(db)
        const pkg = db.packages.find((p) => p.id === id)
        if (!pkg) throw new ServiceError('NOT_FOUND', 'Pacote não encontrado.')
        Object.assign(pkg, validate(db, input, id), { updatedAt: new Date().toISOString() })
        return pkg
      }),
    ),

  setActive: (id: string, active: boolean) =>
    mockCall(() =>
      mutate((db) => {
        requireAdmin(db)
        const pkg = db.packages.find((p) => p.id === id)
        if (!pkg) throw new ServiceError('NOT_FOUND', 'Pacote não encontrado.')
        if (active && pkg.fileIds.length === 0)
          throw new ServiceError('VALIDATION', 'Adicione arquivos antes de ativar o pacote.')
        pkg.active = active
        pkg.updatedAt = new Date().toISOString()
        return pkg
      }),
    ),

  /** Só permite excluir pacotes sem vendas; os demais devem ser desativados. */
  remove: (id: string) =>
    mockCall(() =>
      mutate((db) => {
        requireAdmin(db)
        if (db.orders.some((o) => o.packageId === id) || db.entitlements.some((e) => e.packageId === id))
          throw new ServiceError('CONFLICT', 'Este pacote já tem pedidos ou clientes. Desative-o em vez de excluir.')
        db.packages = db.packages.filter((p) => p.id !== id)
      }),
    ),

  /** Mock: imagens viram data URL reduzida (no backend real irão para o R2). */
  uploadCover: (file: File) =>
    mockCall(async () => {
      requireAdmin(getDb())
      if (!file.type.startsWith('image/')) throw new ServiceError('VALIDATION', 'A capa precisa ser uma imagem.')
      return { url: await resizeToDataUrl(file, 800) }
    }),
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

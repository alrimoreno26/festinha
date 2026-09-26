// Área do cliente: o que o cliente logado comprou e pode baixar.

import { canDownload, entitlementStatus } from '@/lib/entitlements'
import { mockCall } from '@/lib/mock/call'
import { requireUser } from '@/lib/mock/session'
import { getDb, mutate, newId, type MockDB } from '@/lib/mock/store'
import type { Entitlement, EntitlementStatus, FileItem, Order, Package } from '@/lib/types'
import { ServiceError } from './errors'

export type KitFile = Pick<FileItem, 'id' | 'filename' | 'mime' | 'size'>

export interface MyKit {
  entitlement: Entitlement
  status: EntitlementStatus
  package: Pick<Package, 'id' | 'slug' | 'title' | 'description' | 'coverUrl'>
  fileCount: number
}

export interface MyKitDetail extends MyKit {
  files: KitFile[]
}

const STATUS_ORDER: Record<EntitlementStatus, number> = { expiring: 0, active: 1, expired: 2, revoked: 3 }

function toKit(db: MockDB, e: Entitlement): MyKit {
  const pkg = db.packages.find((p) => p.id === e.packageId)
  return {
    entitlement: e,
    status: entitlementStatus(e),
    package: {
      id: e.packageId,
      slug: pkg?.slug ?? '',
      title: pkg?.title ?? 'Pacote removido',
      description: pkg?.description ?? '',
      coverUrl: pkg?.coverUrl ?? null,
    },
    fileCount: pkg?.fileIds.length ?? 0,
  }
}

export const accountService = {
  myKits: () =>
    mockCall<MyKit[]>(() => {
      const db = getDb()
      const user = requireUser(db)
      return db.entitlements
        .filter((e) => e.userId === user.id)
        .map((e) => toKit(db, e))
        .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.entitlement.createdAt.localeCompare(a.entitlement.createdAt))
    }),

  myKit: (packageId: string) =>
    mockCall<MyKitDetail>(() => {
      const db = getDb()
      const user = requireUser(db)
      const ent = db.entitlements.find((e) => e.userId === user.id && e.packageId === packageId)
      if (!ent) throw new ServiceError('NOT_FOUND', 'Você não tem acesso a este kit.')
      const kit = toKit(db, ent)
      const pkg = db.packages.find((p) => p.id === packageId)
      const files = canDownload(kit.status)
        ? (pkg?.fileIds ?? [])
            .map((id) => db.files.find((f) => f.id === id))
            .filter((f): f is FileItem => !!f)
            .map(({ id, filename, mime, size }) => ({ id, filename, mime, size }))
        : []
      return { ...kit, files }
    }),

  myOrders: () =>
    mockCall(() => {
      const db = getDb()
      const user = requireUser(db)
      return db.orders
        .filter((o) => o.userId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ autoApproveAt: _a, ...o }): Order & { packageTitle: string } => ({
          ...o,
          packageTitle: db.packages.find((p) => p.id === o.packageId)?.title ?? '—',
        }))
    }),

  /**
   * No real: o servidor valida o acesso e devolve uma URL assinada do R2 (expira em ~5 min).
   * No mock: gera um arquivo de demonstração no navegador.
   */
  getDownloadUrl: (fileId: string) =>
    mockCall(() =>
      mutate((db) => {
        const user = requireUser(db)
        const file = db.files.find((f) => f.id === fileId)
        if (!file) throw new ServiceError('NOT_FOUND', 'Arquivo não encontrado.')
        const allowed = db.entitlements.some(
          (e) =>
            e.userId === user.id &&
            canDownload(entitlementStatus(e)) &&
            db.packages.find((p) => p.id === e.packageId)?.fileIds.includes(fileId),
        )
        if (!allowed) throw new ServiceError('FORBIDDEN', 'Seu acesso a este arquivo expirou ou foi revogado.')
        db.downloads.push({ id: newId('dl'), userId: user.id, fileId, createdAt: new Date().toISOString() })
        const blob = new Blob(
          [`Arquivo de demonstração — Festinhas\n\n${file.filename}\n${file.key}\n\nNo sistema real este download vem do Cloudflare R2.`],
          { type: 'text/plain' },
        )
        return { url: URL.createObjectURL(blob), filename: `${file.filename}.demo.txt` }
      }),
    ),
}

// Área do cliente: o que o cliente logado comprou e pode baixar.

import type { KitFile, MyKit, MyKitDetail, MyOrder } from '@/lib/contracts'
import { canDownload, entitlementStatus } from '@/lib/entitlements'
import { ServiceError } from '@/lib/services/errors'
import type { EntitlementStatus } from '@/lib/types'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { requireCustomer, type Actor } from '../guards'
import { newId } from '../ids'
import { toEntitlement, toFile, toOrder } from '../mappers'
import { getStorage, type Storage } from '../storage'

const STATUS_ORDER: Record<EntitlementStatus, number> = { expiring: 0, active: 1, expired: 2, revoked: 3 }

async function kitsOf(db: Db, userId: string, packageId?: string): Promise<MyKit[]> {
  const rows = await db
    .select({
      ent: t.entitlements,
      pkg: { id: t.packages.id, slug: t.packages.slug, title: t.packages.title, description: t.packages.description, coverUrl: t.packages.coverUrl },
      fileCount: sql<number>`(select count(*)::int from ${t.packageFiles} where ${t.packageFiles.packageId} = ${t.packages.id})`,
    })
    .from(t.entitlements)
    .innerJoin(t.packages, eq(t.entitlements.packageId, t.packages.id))
    .where(packageId ? and(eq(t.entitlements.userId, userId), eq(t.entitlements.packageId, packageId)) : eq(t.entitlements.userId, userId))
  return rows.map(({ ent, pkg, fileCount }) => {
    const entitlement = toEntitlement(ent)
    return { entitlement, status: entitlementStatus(entitlement), package: pkg, fileCount }
  })
}

export async function myKits(db: Db, actor: Actor) {
  const user = requireCustomer(actor)
  return (await kitsOf(db, user.id)).sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.entitlement.createdAt.localeCompare(a.entitlement.createdAt),
  )
}

export async function myKit(db: Db, actor: Actor, packageId: string): Promise<MyKitDetail> {
  const user = requireCustomer(actor)
  const [kit] = await kitsOf(db, user.id, packageId)
  if (!kit) throw new ServiceError('NOT_FOUND', 'Você não tem acesso a este kit.')
  // Sem acesso válido, a lista de arquivos nem é enviada.
  const files = canDownload(kit.status)
    ? (
        await db
          .select({ file: t.files })
          .from(t.packageFiles)
          .innerJoin(t.files, eq(t.packageFiles.fileId, t.files.id))
          .where(eq(t.packageFiles.packageId, packageId))
          .orderBy(asc(t.packageFiles.position))
      ).map(({ file }) => {
        const { id, filename, mime, size } = toFile(file)
        return { id, filename, mime, size }
      })
    : []
  return { ...kit, files }
}

export async function myOrders(db: Db, actor: Actor): Promise<MyOrder[]> {
  const user = requireCustomer(actor)
  const rows = await db
    .select({ order: t.orders, packageTitle: t.packages.title, packageKind: t.packages.kind })
    .from(t.orders)
    .leftJoin(t.packages, eq(t.orders.packageId, t.packages.id))
    .where(eq(t.orders.userId, user.id))
    .orderBy(desc(t.orders.createdAt))

  // Os arquivos finais só aparecem quando o pedido personalizado foi entregue.
  const delivered = rows.filter((r) => canDownloadOrder(r.order)).map((r) => r.order.id)
  const files = delivered.length
    ? await db
        .select({ orderId: t.orderFiles.orderId, file: t.files })
        .from(t.orderFiles)
        .innerJoin(t.files, eq(t.orderFiles.fileId, t.files.id))
        .where(and(inArray(t.orderFiles.orderId, delivered), eq(t.orderFiles.role, 'delivery')))
        .orderBy(asc(t.orderFiles.position))
    : []
  const kitFile = (f: typeof t.files.$inferSelect): KitFile => ({ id: f.id, filename: f.filename, mime: f.mime, size: f.size })

  return rows.map((r) => ({
    ...toOrder(r.order),
    packageTitle: r.packageTitle ?? '—',
    packageKind: r.packageKind ?? 'digital',
    files: files.filter((f) => f.orderId === r.order.id).map((f) => kitFile(f.file)),
  }))
}

const canDownloadOrder = (o: Pick<typeof t.orders.$inferSelect, 'status' | 'productionStatus'>) =>
  o.status === 'approved' && o.productionStatus === 'delivered'

/** Confere se o cliente tem acesso válido a algum pacote que contém o arquivo. */
async function checkDownloadAccess(db: Db, actor: Actor, fileId: string) {
  const user = requireCustomer(actor)
  const [file] = await db.select().from(t.files).where(eq(t.files.id, fileId))
  if (!file) throw new ServiceError('NOT_FOUND', 'Arquivo não encontrado.')

  const grants = await db
    .select({ ent: t.entitlements })
    .from(t.entitlements)
    .innerJoin(t.packageFiles, eq(t.packageFiles.packageId, t.entitlements.packageId))
    .where(and(eq(t.entitlements.userId, user.id), eq(t.packageFiles.fileId, fileId)))
  if (grants.some(({ ent }) => canDownload(entitlementStatus(toEntitlement(ent))))) return { user, file }

  // Arquivo final de um pedido personalizado do próprio cliente.
  const orders = await db
    .select({ status: t.orders.status, productionStatus: t.orders.productionStatus })
    .from(t.orderFiles)
    .innerJoin(t.orders, eq(t.orderFiles.orderId, t.orders.id))
    .where(and(eq(t.orders.userId, user.id), eq(t.orderFiles.fileId, fileId), eq(t.orderFiles.role, 'delivery')))
  if (!orders.some(canDownloadOrder)) throw new ServiceError('FORBIDDEN', 'Seu acesso a este arquivo expirou ou foi revogado.')
  return { user, file }
}

/** Autoriza o download e registra no histórico. */
export async function authorizeDownload(db: Db, actor: Actor, fileId: string) {
  const { user, file } = await checkDownloadAccess(db, actor, fileId)
  await db.insert(t.downloads).values({ id: newId('dl'), userId: user.id, fileId })
  return toFile(file)
}

/**
 * Link de download: confere o acesso, confere que o objeto existe no bucket, registra e devolve
 * uma URL assinada que vence em poucos minutos (não adianta repassar o link).
 */
export async function downloadLink(db: Db, actor: Actor, fileId: string, storage: Storage = getStorage()) {
  const { user, file } = await checkDownloadAccess(db, actor, fileId)
  if (storage.kind !== 'demo' && !(await storage.head(file.key))) {
    console.error('[download] objeto ausente no bucket', file.key)
    throw new ServiceError('NOT_FOUND', 'Este arquivo está temporariamente indisponível. Já fomos avisados; tente de novo mais tarde ou fale com a gente.')
  }
  await db.insert(t.downloads).values({ id: newId('dl'), userId: user.id, fileId })
  const filename = storage.kind === 'demo' ? `${file.filename}.demo.txt` : file.filename
  return { url: await storage.presignDownload(file.key, file.filename, file.mime), filename }
}

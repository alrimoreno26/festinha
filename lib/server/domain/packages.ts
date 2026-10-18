import { customizationFor, type AdminPackageRow, type PackageInput, type PublicPackage } from '@/lib/contracts'
import { slugify } from '@/lib/format'
import { ServiceError } from '@/lib/services/errors'
import type { Package } from '@/lib/types'
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { requireAdmin, type Actor } from '../guards'
import { newId } from '../ids'
import { toPackage } from '../mappers'
import { canShip } from './shipping'

/** fileIds ordenados de cada pacote. */
async function fileIdsByPackage(db: Db, packageIds: string[]) {
  const map = new Map<string, string[]>(packageIds.map((id) => [id, []]))
  if (!packageIds.length) return map
  const rows = await db
    .select({ packageId: t.packageFiles.packageId, fileId: t.packageFiles.fileId })
    .from(t.packageFiles)
    .where(inArray(t.packageFiles.packageId, packageIds))
    .orderBy(asc(t.packageFiles.position))
  rows.forEach((r) => map.get(r.packageId)?.push(r.fileId))
  return map
}

async function loadPackage(db: Db, id: string): Promise<Package> {
  const [row] = await db.select().from(t.packages).where(eq(t.packages.id, id))
  if (!row) throw new ServiceError('NOT_FOUND', 'Pacote não encontrado.')
  return toPackage(row, (await fileIdsByPackage(db, [id])).get(id)!)
}

async function toPublic(db: Db, rows: (typeof t.packages.$inferSelect)[]): Promise<PublicPackage[]> {
  const ids = rows.map((r) => r.id)
  const files = ids.length
    ? await db
        .select({ packageId: t.packageFiles.packageId, filename: t.files.filename, mime: t.files.mime, size: t.files.size })
        .from(t.packageFiles)
        .innerJoin(t.files, eq(t.packageFiles.fileId, t.files.id))
        .where(inArray(t.packageFiles.packageId, ids))
        .orderBy(asc(t.packageFiles.position))
    : []
  return rows.map((r) => {
    const { fileIds: _f, active: _a, ...pkg } = toPackage(r, [])
    return { ...pkg, shippable: canShip(r), files: files.filter((f) => f.packageId === r.id).map(({ filename, mime, size }) => ({ filename, mime, size })) }
  })
}

async function validate(db: Db, input: PackageInput, id?: string): Promise<PackageInput> {
  const errors: Record<string, string> = {}
  const title = input.title.trim()
  const slug = slugify(input.slug || title)
  if (!title) errors.title = 'Informe o título.'
  if (!slug) errors.slug = 'Informe o slug.'
  else {
    const [dup] = await db
      .select({ id: t.packages.id })
      .from(t.packages)
      .where(id ? and(eq(t.packages.slug, slug), ne(t.packages.id, id)) : eq(t.packages.slug, slug))
    if (dup) errors.slug = 'Já existe um pacote com este slug.'
  }
  // Opções de quantidade/preço: cada uma com nome e preço; o preço "a partir de" passa a ser o menor deles.
  const variants = input.variants
    .map((v) => ({
      id: v.id?.trim() || newId('opt'),
      label: v.label.trim(),
      priceCents: v.priceCents,
      ...(v.quantity ? { quantity: v.quantity } : {}),
    }))
    .filter((v) => v.label)
  if (variants.some((v) => !Number.isInteger(v.priceCents) || v.priceCents < 100)) errors.variants = 'Cada opção precisa de um preço de pelo menos R$ 1,00.'
  else if (new Set(variants.map((v) => v.label.toLowerCase())).size !== variants.length) errors.variants = 'Há opções com o mesmo nome.'

  // Impressão por folha (cartões): quantidade livre abaixo do mínimo; as opções começam no mínimo.
  const sp = input.kind === 'printed' ? input.sheetPricing : null
  if (sp) {
    if (!Number.isInteger(sp.cardsPerSheet) || sp.cardsPerSheet < 1 || sp.cardsPerSheet > 100) errors.sheetPricing = 'Informe quantos cartões cabem numa folha (1 a 100).'
    else if (!Number.isInteger(sp.sheetPriceCents) || sp.sheetPriceCents < 100) errors.sheetPricing = 'O preço por folha precisa ser de pelo menos R$ 1,00.'
    else if (!Number.isInteger(sp.minUnitsForOptions) || sp.minUnitsForOptions < 2) errors.sheetPricing = 'Informe a partir de quantas unidades valem as opções.'
    else if (!errors.variants && variants.some((v) => !v.quantity || v.quantity < sp.minUnitsForOptions))
      errors.variants = `Informe a quantidade de cada opção (a partir de ${sp.minUnitsForOptions} unidades).`
  }
  const sheetPricing = sp && !errors.sheetPricing ? { cardsPerSheet: sp.cardsPerSheet, sheetPriceCents: sp.sheetPriceCents, minUnitsForOptions: sp.minUnitsForOptions } : null
  const candidates = [...variants.map((v) => v.priceCents), ...(sheetPricing ? [sheetPricing.sheetPriceCents] : [])]
  const priceCents = candidates.length ? Math.min(...candidates) : input.priceCents
  if (!candidates.length && (!Number.isInteger(priceCents) || priceCents < 100)) errors.priceCents = 'O preço mínimo é R$ 1,00.'
  const line = input.line === 'empresas' ? 'empresas' : 'festas'
  const kind = input.kind
  if (!['digital', 'custom_digital', 'printed'].includes(kind)) errors.kind = 'Tipo de pacote inválido.'
  const digital = kind === 'digital'
  // Só o kit pronto tem arquivos e prazo de acesso; os sob encomenda recebem a arte no próprio pedido.
  const accessDays = digital ? input.accessDays : null
  if (accessDays !== null && (!Number.isInteger(accessDays) || accessDays < 1)) errors.accessDays = 'Informe um número de dias válido.'
  const fileIds = digital ? [...new Set(input.fileIds)] : []
  if (digital && input.active && fileIds.length === 0) errors.fileIds = 'Um kit digital ativo precisa ter pelo menos um arquivo.'

  const items = input.items.map((i) => ({ name: i.name.trim(), quantity: i.quantity })).filter((i) => i.name)
  if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 10_000)) errors.items = 'Informe quantidades entre 1 e 10.000.'
  if (!digital && input.active && items.length === 0) errors.items = 'Liste o que vem no pacote (ex.: 5 Caixa Milk).'

  // Medidas da embalagem (só impressos): opcionais, mas se preenchidas precisam ser completas e plausíveis.
  let shippingBox = kind === 'printed' ? input.shippingBox : null
  if (shippingBox) {
    const { weightGrams, heightCm, widthCm, lengthCm } = shippingBox
    const okDim = (n: number) => Number.isInteger(n) && n >= 1 && n <= 200
    if (!Number.isInteger(weightGrams) || weightGrams < 1 || weightGrams > 30_000) errors.shippingBox = 'Informe o peso em gramas (até 30 kg).'
    else if (![heightCm, widthCm, lengthCm].every(okDim)) errors.shippingBox = 'Informe altura, largura e comprimento em cm (números inteiros).'
    else shippingBox = { weightGrams, heightCm, widthCm, lengthCm }
  }
  if (fileIds.length) {
    const found = await db.select({ id: t.files.id }).from(t.files).where(inArray(t.files.id, fileIds))
    if (found.length !== fileIds.length) errors.fileIds = 'Alguns arquivos não existem mais. Revise a lista.'
  }
  if (Object.keys(errors).length) throw new ServiceError('VALIDATION', 'Revise os campos destacados.', errors)
  return { ...input, title, slug, description: input.description.trim(), fileIds, accessDays, items, customizationLevel: customizationFor(kind, input.customizationLevel), shippingBox, variants, priceCents, line, sheetPricing }
}

async function writeFiles(db: Db, packageId: string, fileIds: string[]) {
  await db.delete(t.packageFiles).where(eq(t.packageFiles.packageId, packageId))
  if (fileIds.length) await db.insert(t.packageFiles).values(fileIds.map((fileId, position) => ({ packageId, fileId, position })))
}

// ---- Público ----

export async function listPublic(db: Db) {
  const rows = await db.select().from(t.packages).where(eq(t.packages.active, true)).orderBy(asc(t.packages.createdAt))
  return toPublic(db, rows)
}

export async function getPublicBySlug(db: Db, slug: string) {
  const rows = await db.select().from(t.packages).where(and(eq(t.packages.slug, slug), eq(t.packages.active, true)))
  if (!rows.length) throw new ServiceError('NOT_FOUND', 'Pacote não encontrado.')
  return (await toPublic(db, rows))[0]
}

// ---- Admin ----

export async function list(db: Db, actor: Actor): Promise<AdminPackageRow[]> {
  requireAdmin(actor)
  const rows = await db
    .select({
      pkg: t.packages,
      salesCount: sql<number>`count(${t.orders.id}) filter (where ${t.orders.status} = 'approved')::int`,
      revenueCents: sql<number>`coalesce(sum(${t.orders.amountCents}) filter (where ${t.orders.status} = 'approved'), 0)::int`,
    })
    .from(t.packages)
    .leftJoin(t.orders, eq(t.orders.packageId, t.packages.id))
    .groupBy(t.packages.id)
    .orderBy(asc(t.packages.createdAt))
  const fileIds = await fileIdsByPackage(db, rows.map((r) => r.pkg.id))
  return rows.map((r) => ({ ...toPackage(r.pkg, fileIds.get(r.pkg.id)!), salesCount: r.salesCount, revenueCents: r.revenueCents }))
}

export async function get(db: Db, actor: Actor, id: string) {
  requireAdmin(actor)
  return loadPackage(db, id)
}

export async function create(db: Db, actor: Actor, input: PackageInput) {
  requireAdmin(actor)
  const data = await validate(db, input)
  const id = newId('pkg')
  return db.transaction(async (tx) => {
    const { fileIds, ...fields } = data
    await tx.insert(t.packages).values({ ...fields, id })
    await writeFiles(tx, id, fileIds)
    return loadPackage(tx, id)
  })
}

export async function update(db: Db, actor: Actor, id: string, input: PackageInput) {
  requireAdmin(actor)
  await loadPackage(db, id)
  const data = await validate(db, input, id)
  return db.transaction(async (tx) => {
    const { fileIds, ...fields } = data
    await tx.update(t.packages).set({ ...fields, updatedAt: new Date() }).where(eq(t.packages.id, id))
    await writeFiles(tx, id, fileIds)
    return loadPackage(tx, id)
  })
}

export async function setActive(db: Db, actor: Actor, id: string, active: boolean) {
  requireAdmin(actor)
  const pkg = await loadPackage(db, id)
  if (active && pkg.kind === 'digital' && pkg.fileIds.length === 0) throw new ServiceError('VALIDATION', 'Adicione arquivos antes de ativar o pacote.')
  if (active && pkg.kind !== 'digital' && pkg.items.length === 0) throw new ServiceError('VALIDATION', 'Liste o que vem no pacote antes de ativá-lo.')
  await db.update(t.packages).set({ active, updatedAt: new Date() }).where(eq(t.packages.id, id))
  return { ...pkg, active }
}

/** Só permite excluir pacotes sem vendas; os demais devem ser desativados. */
export async function remove(db: Db, actor: Actor, id: string) {
  requireAdmin(actor)
  const [order] = await db.select({ id: t.orders.id }).from(t.orders).where(eq(t.orders.packageId, id)).limit(1)
  const [ent] = await db.select({ id: t.entitlements.id }).from(t.entitlements).where(eq(t.entitlements.packageId, id)).limit(1)
  if (order || ent) throw new ServiceError('CONFLICT', 'Este pacote já tem pedidos ou clientes. Desative-o em vez de excluir.')
  await db.delete(t.packages).where(eq(t.packages.id, id))
}

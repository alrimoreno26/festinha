// Arquivos dos kits: metadados no banco + objetos no bucket (R2).
// O navegador envia direto para o R2 com URL assinada; o servidor só registra depois de conferir o objeto.

import { MAX_UPLOAD_BYTES, type FolderListing, type SyncResult } from '@/lib/contracts'
import { ServiceError } from '@/lib/services/errors'
import { and, asc, eq, inArray, like, ne, sql } from 'drizzle-orm'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { requireAdmin, type Actor } from '../guards'
import { newId } from '../ids'
import { toFile } from '../mappers'
import { getStorage, mimeFromKey, type Storage } from '../storage'

export const normalizeFolder = (path: string) => path.replace(/^\/+|\/+$/g, '')
const parentOf = (key: string) => key.split('/').slice(0, -1).join('/')
export const joinPath = (folder: string, name: string) => (folder ? `${folder}/${name}` : name)
/** Escapa % e _ para usar num LIKE de prefixo. */
const likePrefix = (prefix: string) => `${prefix.replace(/[\\%_]/g, (c) => `\\${c}`)}/%`

export function sanitizeName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
}

/** Pasta sanitizada (cada segmento), sem "..", sem barras nas pontas. */
function safeFolder(folder: string) {
  return normalizeFolder(folder)
    .split('/')
    .map(sanitizeName)
    .filter((s) => s && s !== '.' && s !== '..')
    .join('/')
}

/** Todas as pastas: as criadas explicitamente + as implícitas nas keys dos arquivos. */
async function allFolders(db: Db) {
  const [explicit, keys] = await Promise.all([db.select({ path: t.folders.path }).from(t.folders), db.select({ key: t.files.key }).from(t.files)])
  const set = new Set(explicit.map((f) => f.path))
  for (const { key } of keys) {
    const parts = key.split('/').slice(0, -1)
    parts.forEach((_, i) => set.add(parts.slice(0, i + 1).join('/')))
  }
  return [...set]
}

async function usedIn(db: Db, fileIds: string[]) {
  const map = new Map<string, { id: string; title: string }[]>(fileIds.map((id) => [id, []]))
  if (!fileIds.length) return map
  const rows = await db
    .select({ fileId: t.packageFiles.fileId, id: t.packages.id, title: t.packages.title })
    .from(t.packageFiles)
    .innerJoin(t.packages, eq(t.packageFiles.packageId, t.packages.id))
    .where(inArray(t.packageFiles.fileId, fileIds))
  rows.forEach(({ fileId, id, title }) => map.get(fileId)?.push({ id, title }))
  return map
}

export async function listFolder(db: Db, actor: Actor, path: string, storage: Storage = getStorage()): Promise<FolderListing> {
  requireAdmin(actor)
  const folder = normalizeFolder(path)
  const [folders, allFiles] = await Promise.all([allFolders(db), db.select().from(t.files).orderBy(asc(t.files.filename))])

  const children = folders
    .filter((f) => parentOf(f) === folder && f !== folder)
    .sort()
    .map((f) => ({ path: f, name: f.split('/').pop()!, fileCount: allFiles.filter((file) => file.key.startsWith(`${f}/`)).length }))
  const here = allFiles.filter((f) => parentOf(f.key) === folder)
  const uses = await usedIn(db, here.map((f) => f.id))
  return {
    path: folder,
    folders: children,
    files: here.map((f) => ({ ...toFile(f), usedIn: uses.get(f.id)! })),
    storage: { kind: storage.kind, bucket: storage.bucket },
  }
}

export async function listAll(db: Db, actor: Actor) {
  requireAdmin(actor)
  return (await db.select().from(t.files).orderBy(asc(t.files.key))).map(toFile)
}

export async function createFolder(db: Db, actor: Actor, parent: string, name: string, storage: Storage = getStorage()) {
  requireAdmin(actor)
  const clean = sanitizeName(name)
  if (!clean) throw new ServiceError('VALIDATION', 'Informe um nome para a pasta.')
  const path = joinPath(safeFolder(parent), clean)
  if ((await allFolders(db)).includes(path)) throw new ServiceError('CONFLICT', 'Já existe uma pasta com este nome.')
  // No bucket também: assim a pasta existe no R2 mesmo vazia (e aparece no painel da Cloudflare).
  await storage.putFolder(path)
  await db.insert(t.folders).values({ path })
  return path
}

export async function removeFolder(db: Db, actor: Actor, path: string, storage: Storage = getStorage()) {
  requireAdmin(actor)
  const folder = normalizeFolder(path)
  const prefix = likePrefix(folder)
  const [file] = await db.select({ id: t.files.id }).from(t.files).where(like(t.files.key, prefix)).limit(1)
  const [sub] = await db.select({ path: t.folders.path }).from(t.folders).where(like(t.folders.path, prefix)).limit(1)
  if (file || sub) throw new ServiceError('CONFLICT', 'A pasta não está vazia.')
  await storage.delete(`${folder}/`)
  await db.delete(t.folders).where(eq(t.folders.path, folder))
}

export interface UploadInput {
  folder: string
  filename: string
  size: number
  mime: string
}

async function uploadTarget(db: Db, input: UploadInput) {
  if (!Number.isFinite(input.size) || input.size < 0) throw new ServiceError('VALIDATION', 'Tamanho inválido.')
  if (input.size > MAX_UPLOAD_BYTES) throw new ServiceError('VALIDATION', 'Arquivo maior que 500 MB.')
  const filename = sanitizeName(input.filename) || 'arquivo'
  const key = joinPath(safeFolder(input.folder), filename)
  const [dup] = await db.select({ id: t.files.id }).from(t.files).where(eq(t.files.key, key))
  if (dup) throw new ServiceError('CONFLICT', `Já existe um arquivo "${input.filename}" nesta pasta.`)
  return { key, filename, mime: input.mime || mimeFromKey(filename) }
}

/**
 * 1º passo do upload: valida e devolve a URL assinada para o navegador enviar direto ao bucket.
 * `uploadUrl` é null no modo demo (o upload é simulado e só os metadados são registrados).
 */
export async function prepareUpload(db: Db, actor: Actor, input: UploadInput, storage: Storage = getStorage()) {
  requireAdmin(actor)
  const { key, mime } = await uploadTarget(db, input)
  const signed = await storage.presignUpload(key, mime, input.size)
  return { key, uploadUrl: signed?.url ?? null, headers: signed?.headers ?? {} }
}

/** 2º passo: registra o arquivo. Com R2, só registra se o objeto realmente chegou ao bucket. */
export async function registerUpload(db: Db, actor: Actor, input: UploadInput, storage: Storage = getStorage()) {
  requireAdmin(actor)
  const { key, filename, mime } = await uploadTarget(db, input)
  let size = input.size
  if (storage.kind !== 'demo') {
    const obj = await storage.head(key)
    if (!obj) throw new ServiceError('VALIDATION', 'O arquivo não chegou ao armazenamento. Tente enviar de novo.')
    size = obj.size
  }
  const [row] = await db.insert(t.files).values({ id: newId('fil'), key, filename, size, mime }).returning()
  return toFile(row)
}

/**
 * Renomeia o nome exibido/baixado pelo cliente. O objeto no bucket continua com a mesma key
 * (o R2 não tem "renomear": seria copiar o arquivo inteiro).
 */
export async function rename(db: Db, actor: Actor, id: string, filename: string) {
  requireAdmin(actor)
  const [file] = await db.select().from(t.files).where(eq(t.files.id, id))
  if (!file) throw new ServiceError('NOT_FOUND', 'Arquivo não encontrado.')
  const clean = filename.trim().replace(/[\\/]+/g, '-')
  if (!clean) throw new ServiceError('VALIDATION', 'Informe um nome válido.')
  const siblings = await db
    .select({ id: t.files.id, key: t.files.key })
    .from(t.files)
    .where(and(eq(t.files.filename, clean), ne(t.files.id, id)))
  if (siblings.some((s) => parentOf(s.key) === parentOf(file.key)))
    throw new ServiceError('CONFLICT', 'Já existe um arquivo com este nome nesta pasta.')
  const [row] = await db.update(t.files).set({ filename: clean }).where(eq(t.files.id, id)).returning()
  return toFile(row)
}

/** Arquivos usados em pacotes só são removidos com `force` (o vínculo com os pacotes cai junto, via cascade). */
export async function remove(db: Db, actor: Actor, id: string, { force = false } = {}, storage: Storage = getStorage()) {
  requireAdmin(actor)
  const [file] = await db.select().from(t.files).where(eq(t.files.id, id))
  if (!file) throw new ServiceError('NOT_FOUND', 'Arquivo não encontrado.')
  const used = (await usedIn(db, [id])).get(id)!
  if (used.length && !force) throw new ServiceError('CONFLICT', `Arquivo usado em: ${used.map((p) => p.title).join(', ')}.`)
  // Primeiro o bucket: se falhar, o registro continua e dá para tentar de novo.
  await storage.delete(file.key)
  await db.delete(t.files).where(eq(t.files.id, id))
  return toFile(file)
}

/**
 * Reconcilia o banco com o bucket:
 * - registra arquivos e pastas que estão no bucket e ainda não estão no banco;
 * - com `prune`, remove os registros cujo arquivo não existe mais no bucket (saem também dos pacotes),
 *   remove pastas que não existem no bucket e oculta do catálogo os pacotes que ficarem sem arquivos.
 */
export async function syncFromBucket(db: Db, actor: Actor, { prune = false } = {}, storage: Storage = getStorage()): Promise<SyncResult> {
  requireAdmin(actor)
  if (storage.kind === 'demo') throw new ServiceError('CONFLICT', 'Armazenamento não configurado (modo demonstração).')

  // O que existe no bucket: arquivos e "pastas" (marcadores e prefixos de arquivos).
  const objects: { key: string; size: number }[] = []
  const bucketFolders = new Set<string>()
  for await (const obj of storage.list()) {
    const parts = obj.key.replace(/\/+$/, '').split('/')
    const dirs = obj.key.endsWith('/') ? parts : parts.slice(0, -1)
    dirs.forEach((_, i) => bucketFolders.add(dirs.slice(0, i + 1).join('/')))
    if (!obj.key.endsWith('/')) objects.push(obj)
  }
  const bucketKeys = new Set(objects.map((o) => o.key))

  const registeredFiles = await db.select({ id: t.files.id, key: t.files.key }).from(t.files)
  const registeredKeys = new Set(registeredFiles.map((f) => f.key))
  const explicitFolders = new Set((await db.select({ path: t.folders.path }).from(t.folders)).map((f) => f.path))

  const toAdd = objects
    .filter((o) => !registeredKeys.has(o.key))
    .map((o) => ({ id: newId('fil'), key: o.key, filename: o.key.split('/').pop()!, size: o.size, mime: mimeFromKey(o.key) }))
  const foldersToAdd = [...bucketFolders].filter((f) => !explicitFolders.has(f))
  const missing = registeredFiles.filter((f) => !bucketKeys.has(f.key))
  const foldersToRemove = [...explicitFolders].filter((f) => !bucketFolders.has(f))

  const affected = missing.length
    ? await db
        .selectDistinct({ id: t.packages.id, title: t.packages.title })
        .from(t.packageFiles)
        .innerJoin(t.packages, eq(t.packageFiles.packageId, t.packages.id))
        .where(inArray(t.packageFiles.fileId, missing.map((f) => f.id)))
    : []

  let deactivatedPackages: string[] = []
  await db.transaction(async (tx) => {
    for (let i = 0; i < toAdd.length; i += 500) await tx.insert(t.files).values(toAdd.slice(i, i + 500))
    if (foldersToAdd.length) await tx.insert(t.folders).values(foldersToAdd.map((path) => ({ path })))
    if (!prune) return

    if (missing.length) await tx.delete(t.files).where(inArray(t.files.id, missing.map((f) => f.id)))
    if (foldersToRemove.length) await tx.delete(t.folders).where(inArray(t.folders.path, foldersToRemove))
    // Pacote ativo sem nenhum arquivo não pode ficar no catálogo.
    const emptied = await tx
      .update(t.packages)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(eq(t.packages.active, true), sql`not exists (select 1 from ${t.packageFiles} where ${t.packageFiles.packageId} = ${t.packages.id})`),
      )
      .returning({ title: t.packages.title })
    deactivatedPackages = emptied.map((p) => p.title)
  })

  return {
    added: toAdd.length,
    addedFolders: foldersToAdd.length,
    alreadyRegistered: objects.length - toAdd.length,
    missingInBucket: prune ? 0 : missing.length,
    affectedPackages: affected.length,
    removed: prune ? missing.length : 0,
    removedFolders: prune ? foldersToRemove.length : 0,
    deactivatedPackages,
  }
}

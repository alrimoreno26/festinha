// Metadados dos arquivos do bucket. Na fase 3 o upload/remoção também mexe no R2;
// aqui fica a parte de banco e as regras.

import { MAX_UPLOAD_BYTES, type FolderListing } from '@/lib/contracts'
import { ServiceError } from '@/lib/services/errors'
import { and, asc, eq, inArray, like, ne } from 'drizzle-orm'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { requireAdmin, type Actor } from '../guards'
import { newId } from '../ids'
import { toFile } from '../mappers'

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

export async function listFolder(db: Db, actor: Actor, path: string): Promise<FolderListing> {
  requireAdmin(actor)
  const folder = normalizeFolder(path)
  const [folders, allFiles] = await Promise.all([allFolders(db), db.select().from(t.files).orderBy(asc(t.files.filename))])

  const children = folders
    .filter((f) => parentOf(f) === folder && f !== folder)
    .sort()
    .map((f) => ({ path: f, name: f.split('/').pop()!, fileCount: allFiles.filter((file) => file.key.startsWith(`${f}/`)).length }))
  const here = allFiles.filter((f) => parentOf(f.key) === folder)
  const uses = await usedIn(db, here.map((f) => f.id))
  return { path: folder, folders: children, files: here.map((f) => ({ ...toFile(f), usedIn: uses.get(f.id)! })) }
}

export async function listAll(db: Db, actor: Actor) {
  requireAdmin(actor)
  return (await db.select().from(t.files).orderBy(asc(t.files.key))).map(toFile)
}

export async function createFolder(db: Db, actor: Actor, parent: string, name: string) {
  requireAdmin(actor)
  const clean = sanitizeName(name)
  if (!clean) throw new ServiceError('VALIDATION', 'Informe um nome para a pasta.')
  const path = joinPath(normalizeFolder(parent), clean)
  if ((await allFolders(db)).includes(path)) throw new ServiceError('CONFLICT', 'Já existe uma pasta com este nome.')
  await db.insert(t.folders).values({ path })
  return path
}

export async function removeFolder(db: Db, actor: Actor, path: string) {
  requireAdmin(actor)
  const folder = normalizeFolder(path)
  const prefix = likePrefix(folder)
  const [file] = await db.select({ id: t.files.id }).from(t.files).where(like(t.files.key, prefix)).limit(1)
  const [sub] = await db.select({ path: t.folders.path }).from(t.folders).where(like(t.folders.path, prefix)).limit(1)
  if (file || sub) throw new ServiceError('CONFLICT', 'A pasta não está vazia.')
  await db.delete(t.folders).where(eq(t.folders.path, folder))
}

/**
 * Registra um arquivo enviado. Na fase 3 isto é chamado depois que o navegador conclui o PUT no R2
 * (com URL assinada); o servidor confere o objeto antes de registrar.
 */
export async function registerUpload(db: Db, actor: Actor, input: { folder: string; filename: string; size: number; mime: string }) {
  requireAdmin(actor)
  if (!Number.isFinite(input.size) || input.size < 0) throw new ServiceError('VALIDATION', 'Tamanho inválido.')
  if (input.size > MAX_UPLOAD_BYTES) throw new ServiceError('VALIDATION', 'Arquivo maior que 500 MB.')
  const filename = sanitizeName(input.filename) || 'arquivo'
  const key = joinPath(normalizeFolder(input.folder), filename)
  const [dup] = await db.select({ id: t.files.id }).from(t.files).where(eq(t.files.key, key))
  if (dup) throw new ServiceError('CONFLICT', `Já existe um arquivo "${input.filename}" nesta pasta.`)
  const [row] = await db
    .insert(t.files)
    .values({ id: newId('fil'), key, filename, size: input.size, mime: input.mime || 'application/octet-stream' })
    .returning()
  return toFile(row)
}

export async function rename(db: Db, actor: Actor, id: string, filename: string) {
  requireAdmin(actor)
  const [file] = await db.select().from(t.files).where(eq(t.files.id, id))
  if (!file) throw new ServiceError('NOT_FOUND', 'Arquivo não encontrado.')
  const clean = sanitizeName(filename)
  if (!clean) throw new ServiceError('VALIDATION', 'Informe um nome válido.')
  const key = joinPath(parentOf(file.key), clean)
  const [dup] = await db.select({ id: t.files.id }).from(t.files).where(and(eq(t.files.key, key), ne(t.files.id, id)))
  if (dup) throw new ServiceError('CONFLICT', 'Já existe um arquivo com este nome nesta pasta.')
  const [row] = await db.update(t.files).set({ key, filename: clean }).where(eq(t.files.id, id)).returning()
  return toFile(row)
}

/** Arquivos usados em pacotes só são removidos com `force` (o vínculo com os pacotes cai junto, via cascade). */
export async function remove(db: Db, actor: Actor, id: string, { force = false } = {}) {
  requireAdmin(actor)
  const [file] = await db.select().from(t.files).where(eq(t.files.id, id))
  if (!file) throw new ServiceError('NOT_FOUND', 'Arquivo não encontrado.')
  const used = (await usedIn(db, [id])).get(id)!
  if (used.length && !force) throw new ServiceError('CONFLICT', `Arquivo usado em: ${used.map((p) => p.title).join(', ')}.`)
  await db.delete(t.files).where(eq(t.files.id, id))
  return toFile(file)
}


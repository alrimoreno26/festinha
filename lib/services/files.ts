import { mockCall, sleep } from '@/lib/mock/call'
import { getDevSettings } from '@/lib/mock/dev-settings'
import { requireAdmin } from '@/lib/mock/session'
import { getDb, mutate, newId, type MockDB } from '@/lib/mock/store'
import type { FileItem, Package } from '@/lib/types'
import { MAX_UPLOAD_BYTES, type FolderListing } from '@/lib/contracts'
import { ServiceError } from './errors'

export { MAX_UPLOAD_BYTES } from '@/lib/contracts'
export type { FolderListing } from '@/lib/contracts'

const normalizeFolder = (path: string) => path.replace(/^\/+|\/+$/g, '')
const parentOf = (key: string) => key.split('/').slice(0, -1).join('/')
const joinPath = (folder: string, name: string) => (folder ? `${folder}/${name}` : name)

/** Todas as pastas existentes: as criadas explicitamente + as implícitas nas keys dos arquivos. */
function allFolders(db: MockDB) {
  const set = new Set(db.folders)
  for (const file of db.files) {
    const parts = file.key.split('/').slice(0, -1)
    parts.forEach((_, i) => set.add(parts.slice(0, i + 1).join('/')))
  }
  return [...set]
}

function usedIn(db: MockDB, fileId: string) {
  return db.packages.filter((p) => p.fileIds.includes(fileId)).map(({ id, title }) => ({ id, title }))
}

function sanitizeName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
}

export const filesService = {
  listFolder: (path: string) =>
    mockCall<FolderListing>(() => {
      const db = getDb()
      requireAdmin(db)
      const folder = normalizeFolder(path)
      const folders = allFolders(db)
        .filter((f) => parentOf(f) === folder && f !== folder)
        .sort()
        .map((f) => ({
          path: f,
          name: f.split('/').pop()!,
          fileCount: db.files.filter((file) => file.key.startsWith(`${f}/`)).length,
        }))
      const files = db.files
        .filter((f) => parentOf(f.key) === folder)
        .sort((a, b) => a.filename.localeCompare(b.filename))
        .map((f) => ({ ...f, usedIn: usedIn(db, f.id) }))
      return { path: folder, folders, files }
    }),

  /** Lista plana, usada no seletor de arquivos do pacote. */
  listAll: () =>
    mockCall(() => {
      const db = getDb()
      requireAdmin(db)
      return [...db.files].sort((a, b) => a.key.localeCompare(b.key))
    }),

  createFolder: (parent: string, name: string) =>
    mockCall(() =>
      mutate((db) => {
        requireAdmin(db)
        const clean = sanitizeName(name)
        if (!clean) throw new ServiceError('VALIDATION', 'Informe um nome para a pasta.')
        const path = joinPath(normalizeFolder(parent), clean)
        if (allFolders(db).includes(path)) throw new ServiceError('CONFLICT', 'Já existe uma pasta com este nome.')
        db.folders.push(path)
        return path
      }),
    ),

  removeFolder: (path: string) =>
    mockCall(() =>
      mutate((db) => {
        requireAdmin(db)
        const folder = normalizeFolder(path)
        const hasContent =
          db.files.some((f) => f.key.startsWith(`${folder}/`)) || db.folders.some((f) => f.startsWith(`${folder}/`))
        if (hasContent) throw new ServiceError('CONFLICT', 'A pasta não está vazia.')
        db.folders = db.folders.filter((f) => f !== folder)
      }),
    ),

  /**
   * Mock do upload direto para o R2 (URL assinada PUT). Simula o progresso pelo tamanho do arquivo.
   * Só guarda os metadados — o conteúdo não é armazenado.
   */
  upload: async (file: File, folder: string, onProgress?: (percent: number) => void): Promise<FileItem> => {
    if (file.size > MAX_UPLOAD_BYTES) throw new ServiceError('VALIDATION', 'Arquivo maior que 500 MB.')
    const key = joinPath(normalizeFolder(folder), sanitizeName(file.name) || 'arquivo')
    if (getDb().files.some((f) => f.key === key))
      throw new ServiceError('CONFLICT', `Já existe um arquivo "${file.name}" nesta pasta.`)

    const slow = getDevSettings().latency === 'slow'
    const steps = Math.min(40, Math.max(8, Math.round(file.size / 1_000_000)))
    for (let i = 1; i <= steps; i++) {
      await sleep((slow ? 180 : 60) + Math.random() * 60)
      if (getDevSettings().networkError) throw new ServiceError('NETWORK', 'O envio falhou. Tente novamente.')
      onProgress?.(Math.round((i / steps) * 100))
    }

    return mockCall(() =>
      mutate((db) => {
        requireAdmin(db)
        const item: FileItem = {
          id: newId('fil'),
          key,
          filename: key.split('/').pop()!,
          size: file.size,
          mime: file.type || 'application/octet-stream',
          createdAt: new Date().toISOString(),
        }
        db.files.push(item)
        return item
      }),
    )
  },

  rename: (id: string, filename: string) =>
    mockCall(() =>
      mutate((db) => {
        requireAdmin(db)
        const file = db.files.find((f) => f.id === id)
        if (!file) throw new ServiceError('NOT_FOUND', 'Arquivo não encontrado.')
        const clean = sanitizeName(filename)
        if (!clean) throw new ServiceError('VALIDATION', 'Informe um nome válido.')
        const key = joinPath(parentOf(file.key), clean)
        if (db.files.some((f) => f.key === key && f.id !== id))
          throw new ServiceError('CONFLICT', 'Já existe um arquivo com este nome nesta pasta.')
        file.key = key
        file.filename = clean
        return file
      }),
    ),

  /** Arquivos usados em pacotes só são removidos com `force`, que também os tira dos pacotes. */
  remove: (id: string, { force = false } = {}) =>
    mockCall(() =>
      mutate((db) => {
        requireAdmin(db)
        const used = usedIn(db, id)
        if (used.length && !force)
          throw new ServiceError('CONFLICT', `Arquivo usado em: ${used.map((p) => p.title).join(', ')}.`)
        db.packages.forEach((p) => (p.fileIds = p.fileIds.filter((f) => f !== id)))
        db.files = db.files.filter((f) => f.id !== id)
      }),
    ),
}

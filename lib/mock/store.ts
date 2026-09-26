// Banco de dados simulado: vive em memória e é persistido no localStorage.
// Só é usado pelos serviços (lib/services) — a UI nunca importa daqui.

import type { Download, Entitlement, FileItem, ID, Order, OutboxEmail, Package, User } from '@/lib/types'
import { createSeed } from './seed'

export interface MockUser extends User {
  /** Apenas no mock. No backend real será um hash. */
  password: string
}

/** No mock, um Pix pendente pode ser "confirmado" sozinho depois de alguns segundos. */
export interface MockOrder extends Order {
  autoApproveAt?: string | null
}

export interface PasswordReset {
  token: string
  userId: ID
  expiresAt: string
}

export interface MockDB {
  users: MockUser[]
  files: FileItem[]
  /** Pastas criadas explicitamente (pastas com arquivos são derivadas das keys). */
  folders: string[]
  packages: Package[]
  orders: MockOrder[]
  entitlements: Entitlement[]
  downloads: Download[]
  outbox: OutboxEmail[]
  passwordResets: PasswordReset[]
}

const KEY = 'festinhas:mock-db:v1'

type Listener = () => void
const listeners = new Set<Listener>()
let db: MockDB | null = null
let version = 0

function notify() {
  version++
  listeners.forEach((l) => l())
}

/** Muda a cada alteração — útil para useSyncExternalStore. */
export const getDbVersion = () => version

function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db))
  } catch {}
}

export function getDb(): MockDB {
  if (db) return db
  try {
    const raw = window.localStorage.getItem(KEY)
    db = raw ? (JSON.parse(raw) as MockDB) : createSeed()
  } catch {
    db = createSeed()
  }
  if (!db) db = createSeed()
  save()
  return db
}

/**
 * Altera o banco e notifica quem estiver escutando (ex.: DevToolbar).
 * Se `fn` lançar erro, descarta as alterações em memória (recarrega o último estado salvo).
 */
export function mutate<T>(fn: (db: MockDB) => T): T {
  let result: T
  try {
    result = fn(getDb())
  } catch (err) {
    db = null
    throw err
  }
  save()
  notify()
  return result
}

export function resetDb(kind: 'seed' | 'empty') {
  const seed = createSeed()
  db =
    kind === 'seed'
      ? seed
      : {
          // Mantém apenas os usuários para poder continuar logado.
          ...seed,
          files: [],
          folders: [],
          packages: [],
          orders: [],
          entitlements: [],
          downloads: [],
          outbox: [],
          passwordResets: [],
        }
  save()
  notify()
}

export function subscribeDb(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

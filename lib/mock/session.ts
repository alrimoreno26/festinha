import { ServiceError } from '@/lib/services/errors'
import type { User } from '@/lib/types'
import type { MockDB, MockUser } from './store'

const KEY = 'festinhas:session:v1'

export function getSessionUserId(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setSessionUserId(userId: string | null) {
  try {
    if (userId) window.localStorage.setItem(KEY, userId)
    else window.localStorage.removeItem(KEY)
  } catch {}
}

export function publicUser({ password: _password, ...user }: MockUser): User {
  return user
}

export function currentUser(db: MockDB): MockUser | null {
  const id = getSessionUserId()
  return (id && db.users.find((u) => u.id === id)) || null
}

export function requireUser(db: MockDB): MockUser {
  const user = currentUser(db)
  if (!user) throw new ServiceError('UNAUTHORIZED', 'Faça login para continuar.')
  return user
}

export function requireAdmin(db: MockDB): MockUser {
  const user = requireUser(db)
  if (user.role !== 'admin') throw new ServiceError('FORBIDDEN', 'Acesso restrito à administração.')
  return user
}

const WORDS = ['festa', 'balao', 'bolo', 'confete', 'doce', 'laco']

export function generateTempPassword() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)]
  return `${word}-${Math.floor(1000 + Math.random() * 9000)}`
}

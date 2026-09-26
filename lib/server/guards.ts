import { ServiceError } from '@/lib/services/errors'
import type { User } from '@/lib/types'

/** Quem está fazendo a chamada (resolvido pela API a partir do cookie de sessão). */
export type Actor = User | null

export function requireUser(actor: Actor): User {
  if (!actor) throw new ServiceError('UNAUTHORIZED', 'Faça login para continuar.')
  return actor
}

export function requireCustomer(actor: Actor): User {
  const user = requireUser(actor)
  if (user.role !== 'customer') throw new ServiceError('FORBIDDEN', 'Área exclusiva para clientes.')
  return user
}

export function requireAdmin(actor: Actor): User {
  const user = requireUser(actor)
  if (user.role !== 'admin') throw new ServiceError('FORBIDDEN', 'Acesso restrito à administração.')
  return user
}

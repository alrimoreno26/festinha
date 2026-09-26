import type { Entitlement, EntitlementStatus } from './types'

const EXPIRING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function entitlementStatus(e: Entitlement, now = Date.now()): EntitlementStatus {
  if (e.revokedAt) return 'revoked'
  if (!e.expiresAt) return 'active'
  const expires = new Date(e.expiresAt).getTime()
  if (expires <= now) return 'expired'
  if (expires - now <= EXPIRING_WINDOW_MS) return 'expiring'
  return 'active'
}

export const canDownload = (status: EntitlementStatus) => status === 'active' || status === 'expiring'

export function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000)
}

/** Texto curto sobre a validade do acesso, para exibir ao cliente. */
export function expiryText(e: Pick<Entitlement, 'expiresAt' | 'revokedAt'>, now = Date.now()) {
  if (e.revokedAt) return 'Acesso encerrado'
  if (!e.expiresAt) return 'Acesso vitalício'
  const ms = new Date(e.expiresAt).getTime() - now
  const date = new Date(e.expiresAt).toLocaleDateString('pt-BR')
  if (ms <= 0) return `Venceu em ${date}`
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000))
  return days <= 1 ? 'Vence hoje' : `Vence em ${days} dias (${date})`
}

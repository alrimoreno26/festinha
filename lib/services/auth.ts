import { mockCall } from '@/lib/mock/call'
import { sendEmail } from '@/lib/mock/fulfillment'
import { currentUser, publicUser, requireUser, setSessionUserId } from '@/lib/mock/session'
import { getDb, mutate } from '@/lib/mock/store'
import type { Session } from '@/lib/types'
import { ServiceError } from './errors'

const MIN_PASSWORD = 8
const RESET_TTL_MS = 60 * 60 * 1000

function assertPassword(password: string) {
  if (password.length < MIN_PASSWORD)
    throw new ServiceError('VALIDATION', `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`, { password: 'too_short' })
}

export const authService = {
  getSession: () =>
    mockCall<Session | null>(() => {
      const user = currentUser(getDb())
      return user ? { user: publicUser(user) } : null
    }),

  login: (email: string, password: string) =>
    mockCall<Session>(() =>
      mutate((db) => {
        const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
        if (!user || user.password !== password) throw new ServiceError('UNAUTHORIZED', 'Email ou senha incorretos.')
        setSessionUserId(user.id)
        return { user: publicUser(user) }
      }),
    ),

  logout: () =>
    mockCall(() =>
      mutate(() => {
        setSessionUserId(null)
      }),
    ),

  /** No primeiro acesso (senha temporária) a senha atual não é pedida. */
  changePassword: (currentPassword: string | null, newPassword: string) =>
    mockCall(() =>
      mutate((db) => {
        const user = requireUser(db)
        if (!user.mustChangePassword && user.password !== currentPassword)
          throw new ServiceError('VALIDATION', 'Senha atual incorreta.', { currentPassword: 'invalid' })
        assertPassword(newPassword)
        user.password = newPassword
        user.mustChangePassword = false
      }),
    ),

  /** Sempre resolve com sucesso para não revelar quais emails têm conta. */
  requestPasswordReset: (email: string) =>
    mockCall(() =>
      mutate((db) => {
        const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
        if (!user) return
        const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
        db.passwordResets.push({ token, userId: user.id, expiresAt: new Date(Date.now() + RESET_TTL_MS).toISOString() })
        sendEmail(db, {
          to: user.email,
          subject: 'Redefinir sua senha',
          body: `Olá, ${user.name}! Recebemos um pedido para redefinir sua senha. O link vale por 1 hora.\n\nSe não foi você, ignore este email.`,
          actionUrl: `/conta/redefinir-senha?token=${token}`,
          actionLabel: 'Criar nova senha',
        })
      }),
    ),

  resetPassword: (token: string, newPassword: string) =>
    mockCall(() =>
      mutate((db) => {
        const reset = db.passwordResets.find((r) => r.token === token)
        if (!reset || new Date(reset.expiresAt).getTime() < Date.now())
          throw new ServiceError('VALIDATION', 'Este link expirou ou já foi usado. Peça um novo.')
        assertPassword(newPassword)
        const user = db.users.find((u) => u.id === reset.userId)
        if (!user) throw new ServiceError('NOT_FOUND', 'Conta não encontrada.')
        user.password = newPassword
        user.mustChangePassword = false
        db.passwordResets = db.passwordResets.filter((r) => r.userId !== user.id)
      }),
    ),

  updateProfile: (data: { name: string; phone: string | null }) =>
    mockCall(() =>
      mutate((db) => {
        const user = requireUser(db)
        if (!data.name.trim()) throw new ServiceError('VALIDATION', 'Informe seu nome.', { name: 'required' })
        user.name = data.name.trim()
        user.phone = data.phone?.trim() || null
        return publicUser(user)
      }),
    ),
}

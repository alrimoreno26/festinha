import type { Session, User } from '@/lib/types'
import { api } from './http'

export const authService = {
  getSession: () => api<Session | null>('GET', '/api/auth/session'),

  login: (email: string, password: string) => api<Session>('POST', '/api/auth/login', { email, password }),

  logout: () => api<null>('POST', '/api/auth/logout'),

  /** No primeiro acesso (senha temporária) a senha atual não é pedida. */
  changePassword: (currentPassword: string | null, newPassword: string) =>
    api<Session>('POST', '/api/auth/password', { currentPassword, newPassword }),

  /** Sempre resolve com sucesso para não revelar quais emails têm conta. */
  requestPasswordReset: (email: string) => api<null>('POST', '/api/auth/password-reset/request', { email }),

  resetPassword: (token: string, newPassword: string) => api<null>('POST', '/api/auth/password-reset/confirm', { token, newPassword }),

  updateProfile: (data: { name: string; phone: string | null }) => api<User>('PATCH', '/api/me/profile', data),
}

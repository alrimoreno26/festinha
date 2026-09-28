// Sessões, login, troca e redefinição de senha.
// A API cuida do cookie; aqui só lidamos com o token (que nunca é gravado — só o hash dele).

import { ServiceError } from '@/lib/services/errors'
import type { User } from '@/lib/types'
import { and, eq, gt, gte, isNull, ne, sql } from 'drizzle-orm'
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from '../auth/password'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { newToken, sha256 } from '../ids'
import { toUser } from '../mappers'
import * as messages from '../email/messages'
import { sendEmail } from './fulfillment'

const DAY = 24 * 60 * 60 * 1000
export const SESSION_TTL_MS = 30 * DAY
/** Sessões com menos que isso de validade são renovadas no próximo uso. */
const SESSION_RENEW_MS = 15 * DAY
const RESET_TTL_MS = 60 * 60 * 1000
const MAX_FAILED_LOGINS = 5
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000

const normalizeEmail = (email: string) => email.trim().toLowerCase()

function assertPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH)
    throw new ServiceError('VALIDATION', `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`, { password: 'too_short' })
}

// Hash usado quando o email não existe, para a resposta levar o mesmo tempo (não revela quais emails têm conta).
let dummyHash: Promise<string> | null = null
const getDummyHash = () => (dummyHash ??= hashPassword('dummy-password-for-timing'))

export async function createSession(db: Db, userId: string, userAgent?: string | null) {
  const token = newToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(t.sessions).values({ id: await sha256(token), userId, expiresAt, userAgent: userAgent?.slice(0, 300) ?? null })
  return { token, expiresAt }
}

/** Resolve o usuário de um token de sessão. Renova a validade quando está perto de vencer. */
export async function validateSession(db: Db, token: string): Promise<{ user: User; expiresAt: Date; renewed: boolean } | null> {
  const id = await sha256(token)
  const [row] = await db
    .select({ session: t.sessions, user: t.users })
    .from(t.sessions)
    .innerJoin(t.users, eq(t.sessions.userId, t.users.id))
    .where(eq(t.sessions.id, id))
  if (!row) return null

  const now = Date.now()
  if (row.session.expiresAt.getTime() <= now) {
    await db.delete(t.sessions).where(eq(t.sessions.id, id))
    return null
  }
  if (row.session.expiresAt.getTime() - now < SESSION_RENEW_MS) {
    const expiresAt = new Date(now + SESSION_TTL_MS)
    await db.update(t.sessions).set({ expiresAt }).where(eq(t.sessions.id, id))
    return { user: toUser(row.user), expiresAt, renewed: true }
  }
  return { user: toUser(row.user), expiresAt: row.session.expiresAt, renewed: false }
}

export async function login(db: Db, emailInput: string, password: string, userAgent?: string | null) {
  const email = normalizeEmail(emailInput)

  const [{ failures }] = await db
    .select({ failures: sql<number>`count(*)::int` })
    .from(t.loginAttempts)
    .where(
      and(
        eq(t.loginAttempts.email, email),
        eq(t.loginAttempts.success, false),
        gte(t.loginAttempts.createdAt, new Date(Date.now() - FAILED_LOGIN_WINDOW_MS)),
      ),
    )
  if (failures >= MAX_FAILED_LOGINS)
    throw new ServiceError('RATE_LIMITED', 'Muitas tentativas. Aguarde 15 minutos ou redefina sua senha.')

  const [user] = await db.select().from(t.users).where(eq(t.users.email, email))
  const ok = user ? await verifyPassword(user.passwordHash, password) : (await verifyPassword(await getDummyHash(), password), false)

  await db.insert(t.loginAttempts).values({ email, success: ok })
  if (!ok || !user) throw new ServiceError('UNAUTHORIZED', 'Email ou senha incorretos.')

  const session = await createSession(db, user.id, userAgent)
  return { ...session, user: toUser(user) }
}

export async function logout(db: Db, token: string) {
  await db.delete(t.sessions).where(eq(t.sessions.id, await sha256(token)))
}

/**
 * Troca a senha. No primeiro acesso (senha temporária) a senha atual não é pedida.
 * Encerra as outras sessões do usuário, mantendo a atual.
 */
export async function changePassword(db: Db, user: User, currentToken: string, currentPassword: string | null, newPassword: string) {
  const [row] = await db.select().from(t.users).where(eq(t.users.id, user.id))
  if (!row) throw new ServiceError('UNAUTHORIZED', 'Faça login para continuar.')
  if (!row.mustChangePassword && !(await verifyPassword(row.passwordHash, currentPassword ?? '')))
    throw new ServiceError('VALIDATION', 'Senha atual incorreta.', { currentPassword: 'invalid' })
  assertPassword(newPassword)

  await db
    .update(t.users)
    .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false, updatedAt: new Date() })
    .where(eq(t.users.id, user.id))
  await db.delete(t.sessions).where(and(eq(t.sessions.userId, user.id), ne(t.sessions.id, await sha256(currentToken))))
}

/** Sempre "funciona" para quem chama — não revela quais emails têm conta. */
export async function requestPasswordReset(db: Db, emailInput: string) {
  const [user] = await db.select().from(t.users).where(eq(t.users.email, normalizeEmail(emailInput)))
  if (!user) return

  const token = newToken()
  await db.insert(t.passwordResets).values({
    tokenHash: await sha256(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  })
  await sendEmail(db, { to: user.email, ...messages.passwordReset({ name: user.name, token }) })
}

/** Redefine a senha com o token do email. Uso único; encerra todas as sessões do usuário. */
export async function resetPassword(db: Db, token: string, newPassword: string) {
  const [reset] = await db
    .select()
    .from(t.passwordResets)
    .where(
      and(eq(t.passwordResets.tokenHash, await sha256(token)), isNull(t.passwordResets.usedAt), gt(t.passwordResets.expiresAt, new Date())),
    )
  if (!reset) throw new ServiceError('VALIDATION', 'Este link expirou ou já foi usado. Peça um novo.')
  assertPassword(newPassword)

  await db
    .update(t.users)
    .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false, updatedAt: new Date() })
    .where(eq(t.users.id, reset.userId))
  // Invalida este e qualquer outro link pendente do usuário.
  await db.update(t.passwordResets).set({ usedAt: new Date() }).where(and(eq(t.passwordResets.userId, reset.userId), isNull(t.passwordResets.usedAt)))
  await db.delete(t.sessions).where(eq(t.sessions.userId, reset.userId))
}

export async function updateProfile(db: Db, user: User, data: { name: string; phone: string | null }) {
  const name = data.name.trim()
  if (!name) throw new ServiceError('VALIDATION', 'Informe seu nome.', { name: 'required' })
  const [row] = await db
    .update(t.users)
    .set({ name, phone: data.phone?.trim() || null, updatedAt: new Date() })
    .where(eq(t.users.id, user.id))
    .returning()
  return toUser(row)
}

import * as auth from '@/lib/server/domain/auth'
import { sha256 } from '@/lib/server/ids'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createSeededDb, emailsTo, t } from '../helpers/db'

describe('login e sessão', () => {
  it('login válido cria uma sessão que resolve o usuário; logout encerra', async () => {
    const { db, accounts } = await createSeededDb()
    const { token, user } = await auth.login(db, accounts.maria.email, accounts.maria.password)
    expect(user.email).toBe(accounts.maria.email)

    // O token nunca é gravado: só o hash dele.
    const [row] = await db.select().from(t.sessions)
    expect(row.id).toBe(await sha256(token))
    expect(row.id).not.toBe(token)

    expect((await auth.validateSession(db, token))?.user.id).toBe(user.id)
    await auth.logout(db, token)
    expect(await auth.validateSession(db, token)).toBeNull()
  })

  it('email é case-insensitive e senha errada é recusada', async () => {
    const { db, accounts } = await createSeededDb()
    await expect(auth.login(db, accounts.maria.email.toUpperCase(), accounts.maria.password)).resolves.toBeTruthy()
    await expect(auth.login(db, accounts.maria.email, 'errada')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(auth.login(db, 'ninguem@festinhas.test', 'qualquer')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('bloqueia depois de 5 tentativas erradas, mesmo com a senha certa', async () => {
    const { db, accounts } = await createSeededDb()
    for (let i = 0; i < 5; i++) await expect(auth.login(db, accounts.maria.email, 'errada')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(auth.login(db, accounts.maria.email, accounts.maria.password)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('sessão vencida é recusada e removida', async () => {
    const { db, maria } = await createSeededDb()
    const { token } = await auth.createSession(db, maria.id)
    await db.update(t.sessions).set({ expiresAt: new Date(Date.now() - 1000) })
    expect(await auth.validateSession(db, token)).toBeNull()
    expect(await db.select().from(t.sessions)).toHaveLength(0)
  })

  it('sessão perto de vencer é renovada no uso', async () => {
    const { db, maria } = await createSeededDb()
    const { token } = await auth.createSession(db, maria.id)
    await db.update(t.sessions).set({ expiresAt: new Date(Date.now() + 60_000) })
    const result = await auth.validateSession(db, token)
    expect(result?.renewed).toBe(true)
    expect(result!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000)
  })
})

describe('troca de senha', () => {
  it('primeiro acesso troca sem pedir a senha atual e encerra as outras sessões', async () => {
    const { db, ana, accounts } = await createSeededDb()
    const current = await auth.login(db, accounts.ana.email, accounts.ana.password)
    const other = await auth.createSession(db, ana.id)

    await auth.changePassword(db, ana, current.token, null, 'nova-senha-123')
    expect(await auth.validateSession(db, current.token)).not.toBeNull()
    expect(await auth.validateSession(db, other.token)).toBeNull()
    await expect(auth.login(db, accounts.ana.email, 'nova-senha-123')).resolves.toMatchObject({ user: { mustChangePassword: false } })
  })

  it('fora do primeiro acesso exige a senha atual e mínimo de 8 caracteres', async () => {
    const { db, maria, accounts } = await createSeededDb()
    const { token } = await auth.login(db, accounts.maria.email, accounts.maria.password)
    await expect(auth.changePassword(db, maria, token, 'errada', 'nova-senha-123')).rejects.toMatchObject({ details: { currentPassword: 'invalid' } })
    await expect(auth.changePassword(db, maria, token, accounts.maria.password, 'curta')).rejects.toMatchObject({ details: { password: 'too_short' } })
  })
})

describe('redefinição de senha', () => {
  const tokenFrom = (url: string | null) => new URL(url!, 'http://x').searchParams.get('token')!

  it('link funciona uma vez, encerra as sessões e não revela emails inexistentes', async () => {
    const { db, maria, accounts } = await createSeededDb()
    const session = await auth.login(db, accounts.maria.email, accounts.maria.password)

    await expect(auth.requestPasswordReset(db, 'ninguem@festinhas.test')).resolves.toBeUndefined()
    await auth.requestPasswordReset(db, accounts.maria.email)
    const [email] = await emailsTo(db, maria.email)
    const token = tokenFrom(email.actionUrl)

    // Só o hash fica no banco.
    const [reset] = await db.select().from(t.passwordResets).where(eq(t.passwordResets.userId, maria.id))
    expect(reset.tokenHash).toBe(await sha256(token))

    await auth.resetPassword(db, token, 'redefinida-123')
    expect(await auth.validateSession(db, session.token)).toBeNull()
    await expect(auth.login(db, accounts.maria.email, 'redefinida-123')).resolves.toBeTruthy()
    await expect(auth.resetPassword(db, token, 'outra-senha-123')).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('link vencido é recusado', async () => {
    const { db, maria, accounts } = await createSeededDb()
    await auth.requestPasswordReset(db, accounts.maria.email)
    const [email] = await emailsTo(db, maria.email)
    await db.update(t.passwordResets).set({ expiresAt: new Date(Date.now() - 1000) })
    await expect(auth.resetPassword(db, tokenFrom(email.actionUrl), 'redefinida-123')).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

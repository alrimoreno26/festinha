import { dispatchPendingEmails, MAX_ATTEMPTS } from '@/lib/server/email/dispatch'
import { MailerError, type Mailer, type OutgoingEmail } from '@/lib/server/email/mailer'
import { renderEmail } from '@/lib/server/email/template'
import { sendEmail } from '@/lib/server/domain/fulfillment'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createTestDb, t } from '../helpers/db'

function fakeMailer(fail?: (e: OutgoingEmail) => Error | null) {
  const sent: OutgoingEmail[] = []
  const mailer: Mailer = {
    kind: 'resend',
    send: async (e) => {
      const err = fail?.(e)
      if (err) throw err
      sent.push(e)
      return { providerId: `re_${sent.length}` }
    },
  }
  return { mailer, sent }
}

const config = { from: 'Festinhas <contato@festinhas.test>', replyTo: 'suporte@festinhas.test', toOverride: null as string | null, appUrl: 'https://festinhas.test' }

async function dbWithEmail() {
  const db = await createTestDb()
  await sendEmail(db, { to: 'cliente@exemplo.com', subject: 'Seu kit está liberado!', body: 'Olá!\n\nSenha temporária: festa-1234', actionUrl: '/conta/login', actionLabel: 'Acessar meus kits' })
  const [row] = await db.select().from(t.emailOutbox)
  return { db, row }
}

describe('envio de emails', () => {
  it('envia os pendentes com link absoluto e idempotência, e marca como enviado', async () => {
    const { db, row } = await dbWithEmail()
    const { mailer, sent } = fakeMailer()
    expect(await dispatchPendingEmails(db, { mailer, config })).toEqual({ sent: 1, failed: 0 })
    expect(sent[0]).toMatchObject({ id: row.id, to: 'cliente@exemplo.com', from: config.from, replyTo: config.replyTo, subject: 'Seu kit está liberado!' })
    expect(sent[0].html).toContain('href="https://festinhas.test/conta/login"')
    expect(sent[0].text).toContain('Acessar meus kits: https://festinhas.test/conta/login')
    const [after] = await db.select().from(t.emailOutbox).where(eq(t.emailOutbox.id, row.id))
    expect(after).toMatchObject({ providerId: 're_1', lastError: null })
    expect(after.sentAt).not.toBeNull()
    // Já enviado: não reenvia.
    expect(await dispatchPendingEmails(db, { mailer, config })).toEqual({ sent: 0, failed: 0 })
    expect(sent).toHaveLength(1)
  })

  it('com EMAIL_TO_OVERRIDE tudo vai para o endereço de teste, com o destinatário original no assunto', async () => {
    const { db } = await dbWithEmail()
    const { mailer, sent } = fakeMailer()
    await dispatchPendingEmails(db, { mailer, config: { ...config, toOverride: 'eu@festinhas.test' } })
    expect(sent[0]).toMatchObject({ to: 'eu@festinhas.test', subject: '[para cliente@exemplo.com] Seu kit está liberado!' })
  })

  it('falha temporária: conta a tentativa e espera antes de tentar de novo', async () => {
    const { db, row } = await dbWithEmail()
    const { mailer } = fakeMailer(() => new MailerError('Resend 503', false))
    expect(await dispatchPendingEmails(db, { mailer, config })).toEqual({ sent: 0, failed: 1 })
    const [after] = await db.select().from(t.emailOutbox).where(eq(t.emailOutbox.id, row.id))
    expect(after).toMatchObject({ attempts: 1, lastError: 'Resend 503', sentAt: null })
    expect(after.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 30_000)
    // Ainda dentro da espera: não tenta de novo.
    expect(await dispatchPendingEmails(db, { mailer, config })).toEqual({ sent: 0, failed: 0 })
  })

  it('falha permanente (ex.: endereço inválido) desiste na hora', async () => {
    const { db, row } = await dbWithEmail()
    const { mailer } = fakeMailer(() => new MailerError('Resend 422: invalid to', true))
    await dispatchPendingEmails(db, { mailer, config })
    const [after] = await db.select().from(t.emailOutbox).where(eq(t.emailOutbox.id, row.id))
    expect(after.attempts).toBe(MAX_ATTEMPTS)
  })

  it('dois despachos ao mesmo tempo não enviam o mesmo email duas vezes', async () => {
    const { db } = await dbWithEmail()
    const { mailer, sent } = fakeMailer()
    await Promise.all([dispatchPendingEmails(db, { mailer, config }), dispatchPendingEmails(db, { mailer, config })])
    expect(sent).toHaveLength(1)
  })

  it('sem Resend configurado não faz nada (fica na caixa de saída)', async () => {
    const { db } = await dbWithEmail()
    const none: Mailer = { kind: 'none', send: async () => ({ providerId: 'x' }) }
    expect(await dispatchPendingEmails(db, { mailer: none, config })).toEqual({ sent: 0, failed: 0 })
  })
})

describe('layout do email', () => {
  it('escapa HTML do conteúdo e mantém parágrafos e quebras de linha', () => {
    const { html, text } = renderEmail(
      { subject: 'Oi <b>', body: 'Linha 1\nLinha <script>2</script>\n\nOutro parágrafo', actionUrl: 'https://outro.site/x', actionLabel: 'Ir' },
      'https://festinhas.test',
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('Linha 1<br>Linha &lt;script&gt;2&lt;/script&gt;')
    expect(html).toContain('href="https://outro.site/x"')
    expect(text).toContain('Outro parágrafo')
  })
})

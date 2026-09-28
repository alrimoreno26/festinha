// Envia os emails pendentes da email_outbox. Chamado em segundo plano depois de cada operação
// que pode gerar email (e pelo cron). Seguro para rodar em paralelo: cada email é "reservado" antes do envio.

import { and, eq, isNull, lt, lte, sql } from 'drizzle-orm'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { emailConfig, getMailer, MailerError, type Mailer } from './mailer'
import { renderEmail } from './template'

export const MAX_ATTEMPTS = 5
/** Espera antes da próxima tentativa, por número de falhas: 1 min, 5 min, 30 min, 2 h. */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000]
/** Enquanto um envio está em andamento, o email fica reservado por este tempo. */
const LEASE_MS = 2 * 60_000

export async function dispatchPendingEmails(
  db: Db,
  { mailer = getMailer(), config = emailConfig(), limit = 20 }: { mailer?: Mailer; config?: ReturnType<typeof emailConfig>; limit?: number } = {},
) {
  if (mailer.kind === 'none') return { sent: 0, failed: 0 }

  // Reserva atômica: empurra next_attempt_at para frente nos que vamos enviar (SKIP LOCKED = sem disputa).
  // Sempre com o relógio do banco: o next_attempt_at nasce com now() do Postgres, e comparar com o relógio
  // do servidor da aplicação (que pode estar alguns ms atrás) faria um email recém-criado parecer "do futuro".
  const claimed = await db
    .update(t.emailOutbox)
    .set({ nextAttemptAt: sql`now() + ${`${LEASE_MS} milliseconds`}::interval` })
    .where(
      sql`${t.emailOutbox.id} in (
        select ${t.emailOutbox.id} from ${t.emailOutbox}
        where ${and(isNull(t.emailOutbox.sentAt), lt(t.emailOutbox.attempts, MAX_ATTEMPTS), lte(t.emailOutbox.nextAttemptAt, sql`now()`))}
        order by ${t.emailOutbox.createdAt}
        limit ${limit}
        for update skip locked
      )`,
    )
    .returning()

  let sent = 0
  let failed = 0
  for (const email of claimed) {
    const { html, text } = renderEmail(email, config.appUrl)
    const to = config.toOverride ?? email.to
    const subject = config.toOverride && config.toOverride !== email.to ? `[para ${email.to}] ${email.subject}` : email.subject
    try {
      const { providerId } = await mailer.send({ id: email.id, from: config.from, to, replyTo: config.replyTo, subject, html, text })
      await db.update(t.emailOutbox).set({ sentAt: new Date(), providerId, lastError: null }).where(eq(t.emailOutbox.id, email.id))
      sent++
    } catch (err) {
      const attempts = email.attempts + 1
      const permanent = err instanceof MailerError && err.permanent
      const giveUp = permanent || attempts >= MAX_ATTEMPTS
      console.error('[email] falha ao enviar', { id: email.id, attempts, permanent, error: (err as Error).message })
      await db
        .update(t.emailOutbox)
        .set({
          attempts: giveUp ? MAX_ATTEMPTS : attempts,
          lastError: String((err as Error).message).slice(0, 500),
          nextAttemptAt: sql`now() + ${`${BACKOFF_MS[attempts - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1]} milliseconds`}::interval`,
        })
        .where(eq(t.emailOutbox.id, email.id))
      failed++
    }
  }
  return { sent, failed }
}

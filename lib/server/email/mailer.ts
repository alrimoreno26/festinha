// Envio de emails. "resend" quando RESEND_API_KEY existe; senão "none" (os emails ficam só na
// email_outbox e aparecem na DevToolbar, como antes).

export interface OutgoingEmail {
  /** Chave de idempotência: reenviar o mesmo email não gera duplicata no Resend. */
  id: string
  from: string
  to: string
  replyTo?: string | null
  subject: string
  html: string
  text: string
}

export interface Mailer {
  kind: 'resend' | 'none'
  send(email: OutgoingEmail): Promise<{ providerId: string }>
}

export class MailerError extends Error {
  constructor(
    message: string,
    /** Erros permanentes (ex.: endereço inválido) não adianta tentar de novo. */
    public permanent = false,
  ) {
    super(message)
    this.name = 'MailerError'
  }
}

function resend(apiKey: string): Mailer {
  return {
    kind: 'resend',
    async send(email) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': email.id },
        body: JSON.stringify({
          from: email.from,
          to: [email.to],
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      })
      const body = await res.text()
      if (!res.ok) {
        // Só 400/422 são problemas do email em si (ex.: endereço inválido): não adianta tentar de novo.
        // 401/403 (chave ou domínio ainda não verificado), 429 e 5xx se resolvem com o tempo: tenta de novo.
        const permanent = res.status === 400 || res.status === 422
        throw new MailerError(`Resend ${res.status}: ${body.slice(0, 300)}`, permanent)
      }
      return { providerId: (JSON.parse(body) as { id: string }).id }
    },
  }
}

const none: Mailer = {
  kind: 'none',
  send: async () => {
    throw new MailerError('Envio de email não configurado (RESEND_API_KEY).')
  },
}

const env = (name: string) => process.env[name]?.trim().replace(/^(["'])(.*)\1$/, '$2') || undefined

let cached: Mailer | null = null
export function getMailer(): Mailer {
  if (cached) return cached
  const key = env('RESEND_API_KEY')
  cached = key ? resend(key) : none
  return cached
}

export function emailConfig() {
  return {
    from: env('EMAIL_FROM') ?? 'Festinhas <onboarding@resend.dev>',
    replyTo: env('EMAIL_REPLY_TO') ?? null,
    /** Desenvolvimento/preview: todos os emails vão para este endereço (nunca para clientes). */
    toOverride: env('EMAIL_TO_OVERRIDE') ?? null,
    appUrl: (
      env('APP_URL') ??
      (process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : undefined) ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
      'http://localhost:3100'
    ).replace(/\/+$/, ''),
  }
}

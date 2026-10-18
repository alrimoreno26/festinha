// Avisos no Telegram para a dona da loja: um bot manda uma mensagem a cada pedido pago.
//
// Configuração (variáveis de ambiente):
//   TELEGRAM_BOT_TOKEN  token do bot, criado no @BotFather
//   TELEGRAM_CHAT_ID    para quem enviar (um ou mais, separados por vírgula). Descubra com `npm run telegram:setup`.
// Sem as duas, nada é enfileirado nem enviado.
//
// As mensagens passam por uma fila (telegram_outbox), como os emails: se o Telegram falhar, tentamos de novo depois.

import { addressLines } from '@/lib/address'
import { DELIVERY_LABEL, KIND_LABEL } from '@/lib/labels'
import type { Customization, DeliveryMethod, PackageKind, PackageVariant, PaymentMethod, ShippingAddress, ShippingChoice } from '@/lib/types'
import { and, eq, isNull, lt, lte, sql } from 'drizzle-orm'
import * as t from './db/schema'
import type { Db } from './db/types'
import { newId } from './ids'

const envValue = (name: string) => process.env[name]?.trim().replace(/^["']|["']$/g, '') || null

export function telegramConfig() {
  const token = envValue('TELEGRAM_BOT_TOKEN')
  const chatIds = (envValue('TELEGRAM_CHAT_ID') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return token && chatIds.length ? { token, chatIds } : null
}

export class TelegramError extends Error {
  constructor(
    message: string,
    /** 400/401/403/404: token errado, chat inexistente ou bot bloqueado; não adianta repetir. */
    readonly permanent: boolean,
  ) {
    super(message)
  }
}

export interface TelegramClient {
  send(chatId: string, html: string): Promise<void>
}

export function telegramClient(token: string): TelegramClient {
  return {
    async send(chatId, html) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
      })
      if (res.ok) return
      const body = (await res.json().catch(() => null)) as { description?: string } | null
      // Nunca incluir a URL na mensagem de erro: ela contém o token.
      throw new TelegramError(`Telegram HTTP ${res.status}: ${body?.description ?? 'sem detalhes'}`, [400, 401, 403, 404].includes(res.status))
    },
  }
}

// ---------------------------------------------------------------------------
// Mensagem
// ---------------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export interface OrderNotice {
  orderId: string
  packageTitle: string
  packageKind: PackageKind
  amountCents: number
  method: PaymentMethod
  name: string
  email: string
  phone: string
  customization: Customization | null
  deliveryMethod: DeliveryMethod
  shippingAddress: ShippingAddress | null
  shipping: ShippingChoice | null
  variant: PackageVariant | null
  /** Quantos arquivos o cliente enviou (ex.: logo). */
  customerFiles: number
  /** Primeira compra deste email. */
  newCustomer: boolean
  appUrl: string
}

const CUSTOM_LABELS: [keyof Customization, string][] = [
  ['businessName', 'Empresa'],
  ['cardText', 'Textos'],
  ['childName', 'Nome'],
  ['age', 'Idade'],
  ['theme', 'Tema'],
  ['colors', 'Cores'],
  ['notes', 'Obs.'],
]

/** Mensagem de pedido pago, em HTML do Telegram (só <b>, <i>, <code>, <a>). */
export function orderPaidMessage(o: OrderNotice) {
  const digits = o.phone.replace(/\D/g, '')
  const wa = `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`
  const lines = [
    `🎉 <b>Novo pedido pago!</b>`,
    '',
    `📦 <b>${esc(o.packageTitle)}</b>${o.variant ? ` · ${esc(o.variant.label)}` : ''}`,
    `🏷️ ${KIND_LABEL[o.packageKind]}`,
    `💰 <b>${brl(o.amountCents)}</b> · ${o.method === 'pix' ? 'Pix' : 'Cartão'}${o.shipping ? ` <i>(frete ${brl(o.shipping.priceCents)} incluso)</i>` : ''}`,
    '',
    `👤 ${esc(o.name)}${o.newCustomer ? ' <i>(cliente nova)</i>' : ''}`,
    `📱 <a href="${wa}">${esc(o.phone)}</a> (WhatsApp)`,
    `✉️ ${esc(o.email)}`,
  ]

  const custom = o.customization ? CUSTOM_LABELS.filter(([k]) => o.customization![k]) : []
  if (custom.length) {
    lines.push('', `🎨 <b>Personalização</b>`)
    for (const [k, label] of custom) lines.push(`• ${label}: ${esc(o.customization![k])}`)
  }
  if (o.customerFiles) lines.push(`📎 ${o.customerFiles === 1 ? 'Logo/arquivo enviado' : `${o.customerFiles} arquivos enviados`} (baixe no backoffice)`)

  if (o.packageKind === 'printed') {
    if (o.deliveryMethod === 'shipping' && o.shipping) {
      const days = o.shipping.minDays === o.shipping.maxDays ? `${o.shipping.maxDays}` : `${o.shipping.minDays}–${o.shipping.maxDays}`
      lines.push('', `📮 <b>Envio: ${esc([o.shipping.company, o.shipping.service].filter(Boolean).join(' '))}</b> · ${brl(o.shipping.priceCents)} · ${days} dias úteis`)
    } else {
      lines.push('', `🎁 <b>${DELIVERY_LABEL[o.deliveryMethod]}</b>`)
    }
    if (o.shippingAddress) for (const line of addressLines(o.shippingAddress)) lines.push(esc(line))
  } else if (o.packageKind === 'digital') {
    lines.push('', '⚡ Download liberado automaticamente.')
  }

  const next =
    o.packageKind === 'digital' ? null : o.packageKind === 'printed'
        ? o.deliveryMethod === 'shipping'
          ? 'Produzir, comprar a etiqueta no Melhor Envio e informar o rastreio no pedido.'
          : 'Produzir e combinar o horário da retirada.'
        : 'Criar a arte e enviar o arquivo no pedido.'
  if (next) lines.push('', `👉 ${next}`)

  lines.push('', `🧾 <code>${o.orderId}</code>`, `<a href="${o.appUrl.replace(/\/+$/, '')}/admin/pedidos/${o.orderId}">Abrir no backoffice</a>`)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Fila
// ---------------------------------------------------------------------------

/** Enfileira um aviso (na mesma transação do pedido). Sem Telegram configurado, não faz nada. */
export async function notifyTelegram(db: Db, text: string, config = telegramConfig()) {
  if (!config) return
  await db.insert(t.telegramOutbox).values({ id: newId('tg'), text })
}

const MAX_ATTEMPTS = 5
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000]
const LEASE_MS = 2 * 60_000

/** Envia os avisos pendentes. Mesma reserva atômica (SKIP LOCKED + relógio do banco) do despacho de emails. */
export async function dispatchPendingTelegram(db: Db, { config = telegramConfig(), client }: { config?: ReturnType<typeof telegramConfig>; client?: TelegramClient } = {}) {
  if (!config) return { sent: 0, failed: 0 }
  const api = client ?? telegramClient(config.token)

  const claimed = await db
    .update(t.telegramOutbox)
    .set({ nextAttemptAt: sql`now() + ${`${LEASE_MS} milliseconds`}::interval` })
    .where(
      sql`${t.telegramOutbox.id} in (
        select ${t.telegramOutbox.id} from ${t.telegramOutbox}
        where ${and(isNull(t.telegramOutbox.sentAt), lt(t.telegramOutbox.attempts, MAX_ATTEMPTS), lte(t.telegramOutbox.nextAttemptAt, sql`now()`))}
        order by ${t.telegramOutbox.createdAt}
        limit 20
        for update skip locked
      )`,
    )
    .returning()

  let sent = 0
  let failed = 0
  for (const msg of claimed) {
    try {
      for (const chatId of config.chatIds) await api.send(chatId, msg.text)
      await db.update(t.telegramOutbox).set({ sentAt: new Date(), lastError: null }).where(eq(t.telegramOutbox.id, msg.id))
      sent++
    } catch (err) {
      const attempts = msg.attempts + 1
      const giveUp = (err instanceof TelegramError && err.permanent) || attempts >= MAX_ATTEMPTS
      console.error('[telegram] falha ao enviar', { id: msg.id, attempts, error: (err as Error).message })
      await db
        .update(t.telegramOutbox)
        .set({
          attempts: giveUp ? MAX_ATTEMPTS : attempts,
          lastError: String((err as Error).message).slice(0, 500),
          nextAttemptAt: sql`now() + ${`${BACKOFF_MS[attempts - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1]} milliseconds`}::interval`,
        })
        .where(eq(t.telegramOutbox.id, msg.id))
      failed++
    }
  }
  return { sent, failed }
}

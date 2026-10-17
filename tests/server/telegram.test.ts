import * as checkout from '@/lib/server/domain/checkout'
import { approveOrder } from '@/lib/server/domain/fulfillment'
import { dispatchPendingTelegram, orderPaidMessage, TelegramError, type TelegramClient } from '@/lib/server/telegram'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSeededDb, t } from '../helpers/db'

const buyer = { name: 'Beatriz <Teste>', email: 'beatriz@festinhas.test', phone: '(48) 99123-4567' }

describe('mensagem de pedido pago', () => {
  it('traz pedido, cliente, personalização e entrega, escapando HTML', () => {
    const text = orderPaidMessage({
      orderId: 'ord_1',
      packageTitle: 'Plaquinhas & tags',
      packageKind: 'printed',
      amountCents: 3400,
      method: 'pix',
      name: 'Ana <b>',
      email: 'ana@x.com',
      phone: '(48) 99999-0000',
      customization: { childName: 'Miguel', age: '2 anos', theme: 'Safári', colors: '', notes: '' },
      deliveryMethod: 'delivery',
      deliveryAddress: 'Rua A, 1',
      newCustomer: true,
      appUrl: 'https://festinhas.test/',
    })
    expect(text).toContain('Plaquinhas &amp; tags')
    expect(text).toContain('Ana &lt;b&gt;')
    expect(text).toContain('R$')
    expect(text).toContain('• Nome: Miguel')
    expect(text).not.toContain('Cores:')
    expect(text).toContain('Rua A, 1')
    expect(text).toContain('https://wa.me/5548999990000')
    expect(text).toContain('href="https://festinhas.test/admin/pedidos/ord_1"')
  })
})

describe('fila do Telegram', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'teste'
    process.env.TELEGRAM_CHAT_ID = '111, 222'
  })
  afterEach(() => {
    process.env = { ...env }
  })

  it('enfileira só quando o pedido é aprovado, e envia para todos os chats', async () => {
    const { db } = await createSeededDb()
    const { orderId } = await checkout.createOrder(db, { packageSlug: 'kit-safari', ...buyer })
    expect(await db.select().from(t.telegramOutbox)).toHaveLength(0)

    await db.transaction((tx) => approveOrder(tx, orderId))
    await db.transaction((tx) => approveOrder(tx, orderId)) // idempotente: não duplica o aviso
    const queued = await db.select().from(t.telegramOutbox)
    expect(queued).toHaveLength(1)
    expect(queued[0].text).toContain(orderId)

    const sent: string[] = []
    const client: TelegramClient = { send: async (chatId) => void sent.push(chatId) }
    expect(await dispatchPendingTelegram(db, { client })).toEqual({ sent: 1, failed: 0 })
    expect(sent).toEqual(['111', '222'])
    // Já enviado: não manda de novo.
    expect(await dispatchPendingTelegram(db, { client })).toEqual({ sent: 0, failed: 0 })
  })

  it('erro temporário tenta de novo depois; erro permanente desiste', async () => {
    const { db } = await createSeededDb()
    const { orderId } = await checkout.createOrder(db, { packageSlug: 'kit-safari', ...buyer })
    await db.transaction((tx) => approveOrder(tx, orderId))

    const flaky: TelegramClient = { send: async () => Promise.reject(new TelegramError('HTTP 502', false)) }
    expect(await dispatchPendingTelegram(db, { client: flaky })).toEqual({ sent: 0, failed: 1 })
    let [row] = await db.select().from(t.telegramOutbox)
    expect(row).toMatchObject({ attempts: 1, sentAt: null })

    // Reagenda para agora e falha de vez (ex.: bot bloqueado).
    await db.update(t.telegramOutbox).set({ nextAttemptAt: new Date(0) })
    const blocked: TelegramClient = { send: async () => Promise.reject(new TelegramError('HTTP 403', true)) }
    await dispatchPendingTelegram(db, { client: blocked })
    ;[row] = await db.select().from(t.telegramOutbox)
    expect(row.attempts).toBe(5)
  })

  it('sem configuração não enfileira nada', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    const { db } = await createSeededDb()
    const { orderId } = await checkout.createOrder(db, { packageSlug: 'kit-safari', ...buyer })
    await db.transaction((tx) => approveOrder(tx, orderId))
    expect(await db.select().from(t.telegramOutbox)).toHaveLength(0)
  })
})

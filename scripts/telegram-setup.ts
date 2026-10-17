// Ajuda a configurar o bot do Telegram que avisa cada pedido pago.
//
//   npm run telegram:setup            mostra o bot e quem já mandou mensagem para ele (com o chat id)
//   npm run telegram:setup -- --test  envia uma mensagem de exemplo para o TELEGRAM_CHAT_ID
//
// Passo a passo:
//   1. No Telegram, fale com @BotFather → /newbot → escolha nome e usuário → copie o token.
//   2. Coloque no .env.local:  TELEGRAM_BOT_TOKEN=...   (nunca cole o token no chat nem no código)
//   3. Abra o seu bot no Telegram e mande qualquer mensagem (ex.: "oi").
//   4. Rode `npm run telegram:setup`: aparece o seu chat id. Coloque no .env.local: TELEGRAM_CHAT_ID=...
//   5. Rode `npm run telegram:setup -- --test` para receber o exemplo.
//   6. Na Vercel, cadastre as mesmas duas variáveis (Production e Preview).

import { orderPaidMessage, telegramClient } from '../lib/server/telegram'

const token = process.env.TELEGRAM_BOT_TOKEN?.trim().replace(/^["']|["']$/g, '')

async function call<T>(method: string): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`)
  const body = (await res.json()) as { ok: boolean; result: T; description?: string }
  // A URL tem o token: nunca é impressa.
  if (!body.ok) throw new Error(`Telegram recusou ${method}: ${body.description ?? res.status}`)
  return body.result
}

export const sampleMessage = (appUrl: string) =>
  orderPaidMessage({
    orderId: 'ord_exemplo123',
    packageTitle: 'Lembrancinhas – 20 caixinhas',
    packageKind: 'printed',
    amountCents: 4200,
    method: 'pix',
    name: 'Maria Souza',
    email: 'maria@exemplo.com',
    phone: '(48) 99999-0000',
    customization: { childName: 'Miguel', age: '2 anos', theme: 'Fazendinha', colors: 'Azul e amarelo', notes: 'Festa dia 25/10' },
    deliveryMethod: 'delivery',
    deliveryAddress: 'Rua das Gaivotas, 120 – Ingleses, Florianópolis',
    newCustomer: true,
    appUrl,
  })

async function main() {
  if (!token) {
    console.log('Falta TELEGRAM_BOT_TOKEN no .env.local. Crie o bot no @BotFather (veja o passo a passo no topo deste arquivo).')
    process.exit(1)
  }
  const me = await call<{ username: string; first_name: string }>('getMe')
  console.log(`Bot: ${me.first_name} (@${me.username})`)

  if (process.argv.includes('--test')) {
    const chatIds = (process.env.TELEGRAM_CHAT_ID ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (!chatIds.length) {
      console.log('Falta TELEGRAM_CHAT_ID no .env.local. Rode sem --test para descobrir o seu.')
      process.exit(1)
    }
    const client = telegramClient(token)
    const text = `🧪 <i>Mensagem de teste</i>\n\n${sampleMessage(process.env.APP_URL ?? 'https://festinhascriativas.com.br')}`
    for (const id of chatIds) await client.send(id, text)
    console.log(`Exemplo enviado para ${chatIds.length} chat(s).`)
    return
  }

  const updates = await call<{ message?: { chat: { id: number; type: string; first_name?: string; title?: string } } }[]>('getUpdates')
  const chats = new Map<number, string>()
  for (const u of updates) if (u.message) chats.set(u.message.chat.id, u.message.chat.title ?? u.message.chat.first_name ?? u.message.chat.type)
  if (!chats.size) {
    console.log(`Ninguém falou com o bot ainda. Abra t.me/${me.username}, mande "oi" e rode de novo.`)
    return
  }
  console.log('Chats que mandaram mensagem para o bot (use o número em TELEGRAM_CHAT_ID):')
  for (const [id, name] of chats) console.log(`  ${id}  ${name}`)
}

main().catch((err) => {
  console.error('Falha:', err.message)
  process.exit(1)
})

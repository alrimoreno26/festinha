import { desc } from 'drizzle-orm'
import { db } from '../lib/server/db'
import * as t from '../lib/server/db/schema'
async function main() {
  const orders = await db.select().from(t.orders).orderBy(desc(t.orders.createdAt)).limit(3)
  for (const o of orders) {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${o.id}&sort=date_created&criteria=desc`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    })
    const j = await res.json()
    console.log(`\n${o.id} · ${o.createdAt.toISOString()} · pedido=${o.status} · mpStatus=${o.mpStatus ?? '-'} · viaMP=${!!o.mpPreferenceId}`)
    for (const p of j.results ?? [])
      console.log(`   pagamento ${p.id}: ${p.status}/${p.status_detail} · ${p.payment_type_id}/${p.payment_method_id} · ${p.transaction_amount} ${p.currency_id} · live_mode=${p.live_mode}`)
    if (!(j.results ?? []).length) console.log('   (nenhum pagamento no MP)')
  }
  const events = await db.select().from(t.webhookEvents).orderBy(desc(t.webhookEvents.receivedAt)).limit(5)
  console.log('\nwebhooks recebidos:', events.length)
  for (const e of events) console.log(`   ${e.receivedAt.toISOString()} · ${e.topic} · ${e.resourceId} · processado=${!!e.processedAt} · erro=${e.error ?? '-'}`)
}
main().then(() => process.exit(0))

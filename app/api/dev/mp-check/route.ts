import { devOnly, route } from '@/lib/server/http'
import { getPaymentGateway } from '@/lib/server/payments'

/** Diagnóstico do Mercado Pago (só no modo de simulação). Não mostra o token. */
export const GET = route(async () => {
  devOnly()
  const token = process.env.MP_ACCESS_TOKEN?.trim().replace(/^(["'])(.*)\1$/, '$2')
  let account: unknown = null
  if (token) {
    const res = await fetch('https://api.mercadopago.com/users/me', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    const me = (await res.json().catch(() => ({}))) as { id?: number; site_id?: string; tags?: string[] }
    account = { http: res.status, id: me.id ?? null, site: me.site_id ?? null, testUser: !!me.tags?.includes('test_user') }
  }
  return {
    gateway: getPaymentGateway().kind,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    token: token ? { length: token.length, prefix: token.split('-')[0] + '-' } : null,
    webhookSecret: !!process.env.MP_WEBHOOK_SECRET,
    appUrl: process.env.APP_URL ?? null,
    automationBypass: !!process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    account,
  }
})

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

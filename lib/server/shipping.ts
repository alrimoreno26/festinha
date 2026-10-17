// Frete pelo Melhor Envio (Correios e transportadoras): cotação no checkout.
//
// Configuração (variáveis de ambiente):
//   MELHORENVIO_TOKEN     token de acesso (painel do Melhor Envio → Integrações → Permissões de acesso)
//   MELHORENVIO_ENV       "sandbox" ou "production" (padrão: production)
//   MELHORENVIO_FROM_CEP  CEP de onde os pacotes saem
//   MELHORENVIO_SERVICES  opcional: ids dos serviços aceitos, ex. "1,2" (Correios PAC e SEDEX). Vazio = todos.
//
// Sem token, fora da produção, usa uma cotação de demonstração (como o armazenamento em modo demo).
// Em produção sem token, o envio simplesmente não é oferecido (fica só a retirada).

import { BRAND } from '@/lib/brand'
import type { ShippingBox, ShippingChoice } from '@/lib/types'

const envValue = (name: string) => process.env[name]?.trim().replace(/^["']|["']$/g, '') || null

export const onlyDigits = (s: string) => s.replace(/\D/g, '')

export interface QuoteRequest {
  toPostalCode: string
  box: ShippingBox
  /** Valor declarado (seguro), em centavos: o preço do pacote. */
  insuranceCents: number
}

export interface ShippingQuoter {
  kind: 'melhorenvio' | 'demo' | 'none'
  quote(req: QuoteRequest): Promise<ShippingChoice[]>
}

export class ShippingError extends Error {
  constructor(
    message: string,
    /** Problema na nossa configuração (token inválido/expirado, CEP de origem errado): avisar a loja. */
    readonly configProblem = false,
  ) {
    super(message)
  }
}

interface MeQuote {
  id: number
  name: string
  price?: string
  custom_price?: string
  delivery_time?: number
  custom_delivery_time?: number
  delivery_range?: { min: number; max: number }
  custom_delivery_range?: { min: number; max: number }
  company?: { id: number; name: string }
  error?: string
}

const toCents = (v: string | number | undefined) => Math.round(Number(v ?? NaN) * 100)

/** Converte a resposta do Melhor Envio: só serviços sem erro e com preço, do mais barato ao mais caro. */
export function parseQuotes(list: MeQuote[], allowed: number[] | null): ShippingChoice[] {
  return list
    .filter((q) => !q.error && (allowed === null || allowed.includes(q.id)))
    .map((q) => {
      // custom_* já traz as taxas/descontos da conta (recomendação da documentação).
      const priceCents = toCents(q.custom_price ?? q.price)
      const range = q.custom_delivery_range ?? q.delivery_range
      const days = q.custom_delivery_time ?? q.delivery_time ?? range?.max ?? 0
      return {
        serviceId: q.id,
        service: q.name,
        company: q.company?.name ?? '',
        priceCents,
        minDays: range?.min ?? days,
        maxDays: range?.max ?? days,
      }
    })
    .filter((q) => Number.isFinite(q.priceCents) && q.priceCents > 0)
    .sort((a, b) => a.priceCents - b.priceCents || a.maxDays - b.maxDays)
}

function melhorEnvio(token: string, fromCep: string, sandbox: boolean, allowed: number[] | null): ShippingQuoter {
  const base = sandbox ? 'https://sandbox.melhorenvio.com.br' : 'https://melhorenvio.com.br'
  return {
    kind: 'melhorenvio',
    async quote({ toPostalCode, box, insuranceCents }) {
      const res = await fetch(`${base}/api/v2/me/shipment/calculate`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          // Exigido pela API: nome da aplicação + email de contato técnico.
          'User-Agent': `${BRAND.name} (${BRAND.email})`,
        },
        body: JSON.stringify({
          from: { postal_code: fromCep },
          to: { postal_code: toPostalCode },
          products: [
            {
              id: 'pacote',
              width: box.widthCm,
              height: box.heightCm,
              length: box.lengthCm,
              weight: box.weightGrams / 1000,
              insurance_value: Number((insuranceCents / 100).toFixed(2)),
              quantity: 1,
            },
          ],
          options: { receipt: false, own_hand: false },
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (res.status === 401 || res.status === 403) throw new ShippingError(`Melhor Envio recusou o token (HTTP ${res.status})`, true)
      if (res.status === 422) {
        const body = (await res.json().catch(() => null)) as { errors?: Record<string, string[]> } | null
        const fields = Object.keys(body?.errors ?? {})
        // CEP de destino inválido é erro do cliente; qualquer outro campo é problema nosso (origem, medidas).
        if (fields.length && fields.every((k) => k.startsWith('to.'))) throw new ShippingError('CEP de destino inválido.')
        throw new ShippingError(`Melhor Envio recusou a cotação: ${fields.join(', ') || 'dados inválidos'}`, true)
      }
      if (!res.ok) throw new ShippingError(`Melhor Envio indisponível (HTTP ${res.status})`)
      return parseQuotes((await res.json()) as MeQuote[], allowed)
    },
  }
}

/** Cotação de mentira para desenvolvimento: PAC e SEDEX com preço pelo peso e pela "distância" do CEP. */
const demo: ShippingQuoter = {
  kind: 'demo',
  async quote({ toPostalCode, box }) {
    const region = Number(toPostalCode[0] ?? 0)
    const kg = Math.max(0.3, box.weightGrams / 1000)
    const far = Math.abs(region - 8) // origem em SC (CEP 88…)
    return [
      { serviceId: 1, service: 'PAC', company: 'Correios (demonstração)', priceCents: Math.round((1890 + far * 350) * kg), minDays: 4 + far, maxDays: 6 + far },
      { serviceId: 2, service: 'SEDEX', company: 'Correios (demonstração)', priceCents: Math.round((2990 + far * 600) * kg), minDays: 1 + Math.ceil(far / 3), maxDays: 2 + Math.ceil(far / 2) },
    ]
  },
}

const none: ShippingQuoter = {
  kind: 'none',
  async quote() {
    throw new ShippingError('Envio indisponível no momento.')
  },
}

export function getShippingQuoter(): ShippingQuoter {
  const token = envValue('MELHORENVIO_TOKEN')
  const fromCep = onlyDigits(envValue('MELHORENVIO_FROM_CEP') ?? '')
  if (token && fromCep.length === 8) {
    const allowed = (envValue('MELHORENVIO_SERVICES') ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
    return melhorEnvio(token, fromCep, envValue('MELHORENVIO_ENV') === 'sandbox', allowed.length ? allowed : null)
  }
  // Produção nunca usa a cotação de demonstração: sem configuração, não há envio.
  return process.env.VERCEL_ENV === 'production' ? none : demo
}

// ---------------------------------------------------------------------------
// Cache curto: o cliente digita o CEP, vê as opções e confirma; a confirmação reaproveita a cotação
// (e o Melhor Envio não é chamado de novo a cada clique). O servidor sempre recalcula se o cache venceu.
// ---------------------------------------------------------------------------

const CACHE_MS = 10 * 60_000
const cache = new Map<string, { at: number; quotes: ShippingChoice[] }>()

export async function quoteCached(quoter: ShippingQuoter, key: string, req: QuoteRequest) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.quotes
  const quotes = await quoter.quote(req)
  cache.set(key, { at: Date.now(), quotes })
  if (cache.size > 500) for (const [k, v] of cache) if (Date.now() - v.at >= CACHE_MS) cache.delete(k)
  return quotes
}

export function clearQuoteCache() {
  cache.clear()
}

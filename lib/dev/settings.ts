// Configurações da DevToolbar (ficam no navegador). Controlam o simulador de pagamento
// e permitem simular rede lenta ou fora do ar para validar os estados das telas.

export type PaymentOutcome = 'approved' | 'pending' | 'rejected'
/** "real" = sem atraso extra; "slow" = soma 1,5–3 s a cada chamada. */
export type Latency = 'real' | 'slow'

export interface DevSettings {
  paymentOutcome: PaymentOutcome
  /** Segundos até um Pix pendente ser "confirmado" sozinho. 0 = nunca. */
  pixAutoConfirmSeconds: number
  latency: Latency
  networkError: boolean
}

const KEY = 'festinhas:dev-settings:v2'

export const defaultDevSettings: DevSettings = {
  paymentOutcome: 'approved',
  pixAutoConfirmSeconds: 8,
  latency: 'real',
  networkError: false,
}

type Listener = () => void
const listeners = new Set<Listener>()
let cached: DevSettings | null = null

export function getDevSettings(): DevSettings {
  if (cached) return cached
  if (typeof window === 'undefined') return defaultDevSettings
  try {
    const raw = window.localStorage.getItem(KEY)
    cached = raw ? { ...defaultDevSettings, ...JSON.parse(raw) } : defaultDevSettings
  } catch {
    cached = defaultDevSettings
  }
  return cached!
}

export function setDevSettings(patch: Partial<DevSettings>) {
  cached = { ...getDevSettings(), ...patch }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cached))
  } catch {}
  listeners.forEach((l) => l())
}

export function subscribeDevSettings(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Mesma regra da API (lib/server/http.ts): ligado em dev; em produção só se pedido explicitamente. */
export const devToolsEnabled =
  process.env.NODE_ENV !== 'production' ? process.env.NEXT_PUBLIC_DEVTOOLS !== 'false' : process.env.NEXT_PUBLIC_DEVTOOLS === 'true'

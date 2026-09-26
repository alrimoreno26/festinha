// Configurações da DevToolbar: controlam como o mock se comporta para validar cenários.

export type PaymentOutcome = 'approved' | 'pending' | 'rejected'
export type Latency = 'none' | 'normal' | 'slow'

export interface DevSettings {
  paymentOutcome: PaymentOutcome
  /** Segundos até um Pix pendente ser "confirmado" sozinho. 0 = nunca. */
  pixAutoConfirmSeconds: number
  latency: Latency
  networkError: boolean
}

const KEY = 'festinhas:dev-settings:v1'

export const defaultDevSettings: DevSettings = {
  paymentOutcome: 'approved',
  pixAutoConfirmSeconds: 8,
  latency: 'normal',
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

export const devToolsEnabled = process.env.NEXT_PUBLIC_DEVTOOLS !== 'false'

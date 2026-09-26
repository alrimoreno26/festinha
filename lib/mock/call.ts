import { ServiceError } from '@/lib/services/errors'
import { getDevSettings } from './dev-settings'

const LATENCY_MS = { none: [0, 0], normal: [250, 700], slow: [1500, 3000] } as const

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Envolve uma operação do mock com latência e erro de rede simulados. */
export async function mockCall<T>(fn: () => T | Promise<T>): Promise<T> {
  const { latency, networkError } = getDevSettings()
  const [min, max] = LATENCY_MS[latency]
  await sleep(min + Math.random() * (max - min))
  if (networkError) throw new ServiceError('NETWORK', 'Não foi possível conectar. Tente novamente.')
  // Clona para a UI nunca mutar o "banco" por referência.
  return structuredClone(await fn())
}

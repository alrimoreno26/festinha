// Cliente HTTP da API. Converte as respostas de erro de volta em ServiceError,
// então as telas tratam erros exatamente como antes.

import { devToolsEnabled, getDevSettings } from '@/lib/dev/settings'
import { ServiceError, type ServiceErrorCode } from './errors'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Monta a query string ignorando valores vazios. */
export function qs(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') search.set(k, String(v))
  const s = search.toString()
  return s ? `?${s}` : ''
}

export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  // Simulações da DevToolbar (rede lenta / fora do ar).
  if (devToolsEnabled) {
    const { latency, networkError } = getDevSettings()
    if (latency === 'slow') await sleep(1500 + Math.random() * 1500)
    if (networkError) throw new ServiceError('NETWORK', 'Não foi possível conectar. Tente novamente.')
  }

  let res: Response
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    })
  } catch {
    throw new ServiceError('NETWORK', 'Não foi possível conectar. Verifique sua internet e tente novamente.')
  }

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // resposta não-JSON (ex.: página de erro do proxy)
  }

  if (!res.ok) {
    const err = (data as { error?: { code?: ServiceErrorCode; message?: string; details?: Record<string, string> } } | null)?.error
    throw new ServiceError(err?.code ?? 'NETWORK', err?.message ?? 'Algo deu errado. Tente novamente.', err?.details)
  }
  return data as T
}

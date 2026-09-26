// Endpoints da DevToolbar (só existem com o modo de simulação ligado).

import type { OutboxEmail, Session } from '@/lib/types'
import { api } from './http'

export interface DevCounts {
  packages: number
  files: number
  orders: number
  customers: number
  entitlements: number
}

export const devService = {
  outbox: () => api<OutboxEmail[]>('GET', '/api/dev/outbox'),
  clearOutbox: () => api<null>('DELETE', '/api/dev/outbox'),
  /** Entra como uma conta de teste sem senha; `null` sai. */
  loginAs: (email: string | null) => api<Session | null>('POST', '/api/dev/login-as', { email }),
  counts: () => api<DevCounts>('GET', '/api/dev/data'),
  resetData: (kind: 'seed' | 'empty') => api<null>('POST', '/api/dev/data', { kind }),
}

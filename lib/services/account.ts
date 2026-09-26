// Área do cliente: o que o cliente logado comprou e pode baixar.

import type { MyKit, MyKitDetail } from '@/lib/contracts'
import type { Order } from '@/lib/types'
import { api } from './http'

export type { KitFile, MyKit, MyKitDetail } from '@/lib/contracts'

export const accountService = {
  myKits: () => api<MyKit[]>('GET', '/api/me/kits'),

  myKit: (packageId: string) => api<MyKitDetail>('GET', `/api/me/kits/${packageId}`),

  myOrders: () => api<(Order & { packageTitle: string })[]>('GET', '/api/me/orders'),

  /** O servidor valida o acesso, registra o download e devolve a URL (fase 3: assinada do R2, expira em minutos). */
  getDownloadUrl: (fileId: string) => api<{ url: string; filename: string }>('POST', `/api/me/downloads/${fileId}`),
}

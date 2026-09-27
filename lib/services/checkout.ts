// Fluxo público de compra. Com Mercado Pago, createOrder devolve o link do checkout do MP
// (a confirmação chega pelo webhook). Sem MP, o link é o do simulador e `pay` faz o papel do MP.

import type { CheckoutInput, PublicOrder } from '@/lib/contracts'
import { getDevSettings } from '@/lib/dev/settings'
import type { PaymentMethod } from '@/lib/types'
import { api, qs } from './http'

export { checkoutSchema } from '@/lib/contracts'
export type { CheckoutInput, PublicOrder } from '@/lib/contracts'

type CheckoutStart = { orderId: string; checkoutUrl: string }

export const checkoutService = {
  createOrder: (input: CheckoutInput) => api<CheckoutStart>('POST', '/api/checkout', input),

  /** `paymentId`: o Mercado Pago devolve o cliente com ?payment_id=…; o servidor consulta o MP na hora. */
  getOrder: (orderId: string, paymentId?: string | null) => api<PublicOrder>('GET', `/api/orders/${orderId}${qs({ payment_id: paymentId })}`),

  /** Simulador de pagamento: o resultado vem da DevToolbar. */
  pay: (orderId: string, method: PaymentMethod) => {
    const { paymentOutcome, pixAutoConfirmSeconds } = getDevSettings()
    return api<{ returnUrl: string }>('POST', `/api/dev/pay/${orderId}`, { method, outcome: paymentOutcome, pixAutoConfirmSeconds })
  },

  /** Tentar de novo após recusa: cria um novo pedido com os mesmos dados. */
  retry: (orderId: string) => api<CheckoutStart>('POST', `/api/orders/${orderId}/retry`),
}

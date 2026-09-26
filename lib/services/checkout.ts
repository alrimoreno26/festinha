// Fluxo público de compra. Fase 4: createOrder devolve o link do Mercado Pago
// e `pay` deixa de existir (o pagamento acontece lá e a confirmação chega pelo webhook).

import type { CheckoutInput, PublicOrder } from '@/lib/contracts'
import { getDevSettings } from '@/lib/dev/settings'
import type { PaymentMethod } from '@/lib/types'
import { api } from './http'

export { checkoutSchema } from '@/lib/contracts'
export type { CheckoutInput, PublicOrder } from '@/lib/contracts'

type CheckoutStart = { orderId: string; checkoutUrl: string }

export const checkoutService = {
  createOrder: (input: CheckoutInput) => api<CheckoutStart>('POST', '/api/checkout', input),

  getOrder: (orderId: string) => api<PublicOrder>('GET', `/api/orders/${orderId}`),

  /** Simulador de pagamento: o resultado vem da DevToolbar. */
  pay: (orderId: string, method: PaymentMethod) => {
    const { paymentOutcome, pixAutoConfirmSeconds } = getDevSettings()
    return api<{ returnUrl: string }>('POST', `/api/dev/pay/${orderId}`, { method, outcome: paymentOutcome, pixAutoConfirmSeconds })
  },

  /** Tentar de novo após recusa: cria um novo pedido com os mesmos dados. */
  retry: (orderId: string) => api<CheckoutStart>('POST', `/api/orders/${orderId}/retry`),
}

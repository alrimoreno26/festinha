'use client'

// Substitui a página de checkout do Mercado Pago durante a fase de mocks.
// Na fase 4 o cliente será redirecionado para o `init_point` real.

import { Button, ErrorState, PageLoader } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatBRL } from '@/lib/format'
import { getDevSettings, subscribeDevSettings } from '@/lib/mock/dev-settings'
import { checkoutService, errorMessage, qk } from '@/lib/services'
import type { PaymentMethod } from '@/lib/types'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CreditCard, FlaskConical, QrCode } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useSyncExternalStore } from 'react'

const OUTCOME_LABEL = { approved: 'aprovado', pending: 'Pix pendente', rejected: 'recusado' } as const

export default function SimuladorPage({ params }: { params: { orderId: string } }) {
  const router = useRouter()
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const dev = useSyncExternalStore(subscribeDevSettings, getDevSettings, getDevSettings)

  const query = useQuery({ queryKey: qk.publicOrder(params.orderId), queryFn: () => checkoutService.getOrder(params.orderId) })
  const pay = useMutation({
    mutationFn: () => checkoutService.pay(params.orderId, method),
    onSuccess: ({ returnUrl }) => router.replace(returnUrl),
  })

  const status = query.data?.status
  useEffect(() => {
    if (status && status !== 'pending' && !pay.isPending) router.replace(`/checkout/retorno?pedido=${params.orderId}`)
  }, [status, pay.isPending, router, params.orderId])

  const effectiveOutcome = dev.paymentOutcome === 'pending' && method === 'card' ? 'approved' : dev.paymentOutcome

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <div className="bg-amber-100 text-amber-900 text-xs sm:text-sm px-4 py-2 text-center flex items-center justify-center gap-2">
        <FlaskConical size={14} /> Simulação de pagamento — nenhuma cobrança real é feita
      </div>
      <header className="bg-slate-800 text-white">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <p className="font-semibold">Checkout de pagamento</p>
          <p className="text-xs text-slate-300">ambiente de testes</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        {query.isPending ? (
          <PageLoader />
        ) : query.isError ? (
          <div className="rounded-2xl bg-white">
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          </div>
        ) : (
          <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <p className="text-xs text-slate-500">Você está pagando para</p>
              <p className="font-semibold">Festinhas Criativa Papelaria</p>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-slate-600">{query.data.packageTitle}</p>
                <p className="text-2xl font-bold tabular-nums">{formatBRL(query.data.amountCents)}</p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm font-medium">Como você quer pagar?</p>
              {(
                [
                  ['pix', QrCode, 'Pix', 'Aprovação na hora'],
                  ['card', CreditCard, 'Cartão de crédito', 'Na simulação não é preciso digitar dados do cartão'],
                ] as const
              ).map(([key, Icon, label, desc]) => (
                <label
                  key={key}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-4 cursor-pointer',
                    method === key ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:border-slate-400',
                  )}
                >
                  <input type="radio" name="method" className="accent-slate-800" checked={method === key} onChange={() => setMethod(key)} />
                  <Icon size={20} className="text-slate-600" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </label>
              ))}

              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Resultado configurado na DevToolbar: <strong>{OUTCOME_LABEL[effectiveOutcome]}</strong>
              </p>

              {pay.isError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {errorMessage(pay.error)}
                </p>
              )}

              <Button onClick={() => pay.mutate()} loading={pay.isPending} size="lg" className="w-full !bg-slate-800 hover:!bg-slate-900">
                Pagar {formatBRL(query.data.amountCents)}
              </Button>
              <Link href={`/pacotes/${query.data.packageSlug}`} className="block text-center text-sm text-slate-500 hover:text-slate-800 pt-1">
                Cancelar e voltar para a loja
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

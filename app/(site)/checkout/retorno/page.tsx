'use client'

import { FakePixQr } from '@/components/checkout/FakePixQr'
import { Button, ButtonLink, Card, EmptyState, ErrorState, PageLoader, Spinner, useToast } from '@/components/ui'
import { formatBRL } from '@/lib/format'
import { useSession } from '@/lib/hooks/useSession'
import { checkoutService, errorMessage, qk } from '@/lib/services'
import type { PublicOrder } from '@/lib/services/checkout'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Ban, CheckCircle2, Copy, Mail, PartyPopper, ReceiptText, XCircle } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState, type ReactNode } from 'react'

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="max-w-xl mx-auto px-4 py-10 md:py-16">
      <Card className="p-6 sm:p-8 text-center">{children}</Card>
    </main>
  )
}

function StatusIcon({ tone, children }: { tone: 'success' | 'warning' | 'danger' | 'neutral'; children: ReactNode }) {
  const cls = {
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-600',
    neutral: 'bg-gray-100 text-gray-500',
  }[tone]
  return <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${cls}`}>{children}</div>
}

function OrderLine({ order }: { order: PublicOrder }) {
  return (
    <div className="mt-6 rounded-2xl bg-brand-sand/70 px-4 py-3 text-sm flex items-center justify-between gap-4 text-left">
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{order.packageTitle}</p>
        <p className="text-xs text-gray-500">Pedido {order.id}</p>
      </div>
      <p className="font-semibold tabular-nums">{formatBRL(order.amountCents)}</p>
    </div>
  )
}

function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!target) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [target])
  if (!target) return null
  const ms = Math.max(0, new Date(target).getTime() - now)
  return { expired: ms === 0, label: `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}` }
}

function Approved({ order }: { order: PublicOrder }) {
  const { user } = useSession()
  const loggedInAsBuyer = user?.email === order.email
  return (
    <Shell>
      <StatusIcon tone="success">
        <PartyPopper size={30} />
      </StatusIcon>
      <h1 className="text-2xl font-bold text-gray-900">Pagamento confirmado!</h1>
      {order.existingAccount ? (
        <p className="mt-2 text-gray-600">
          O <strong>{order.packageTitle}</strong> já está na sua conta.
          {!loggedInAsBuyer && ' Entre com seu email e senha de sempre.'}
        </p>
      ) : (
        <p className="mt-2 text-gray-600">
          Enviamos para <strong>{order.email}</strong> seus dados de acesso com uma senha temporária.
        </p>
      )}
      <OrderLine order={order} />
      <div className="mt-6 grid gap-2">
        <ButtonLink href={loggedInAsBuyer ? '/conta' : '/conta/login'} size="lg">
          {loggedInAsBuyer ? 'Ver meus kits' : 'Acessar a Área do Cliente'}
        </ButtonLink>
        {!order.existingAccount && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
            <Mail size={12} /> Não chegou? Veja a caixa de spam ou promoções.
          </p>
        )}
      </div>
    </Shell>
  )
}

function PendingPix({ order }: { order: PublicOrder }) {
  const toast = useToast()
  const countdown = useCountdown(order.pix?.expiresAt ?? null)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(order.pix!.copyPaste)
      toast.success('Código Pix copiado!')
    } catch {
      toast.error('Não foi possível copiar. Selecione o código manualmente.')
    }
  }

  if (countdown?.expired) return <Expired order={order} />

  return (
    <Shell>
      <h1 className="text-2xl font-bold text-gray-900">Pague com Pix</h1>
      <p className="mt-2 text-gray-600">Abra o app do seu banco e escaneie o QR code ou use o Pix copia e cola.</p>
      {order.pix && (
        <>
          <FakePixQr code={order.pix.copyPaste} className="mx-auto mt-6 h-52 w-52 rounded-2xl border border-black/5" />
          <div className="mt-4 flex items-stretch gap-2">
            <code className="flex-1 min-w-0 truncate rounded-2xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs text-gray-600 text-left select-all">
              {order.pix.copyPaste}
            </code>
            <Button variant="secondary" size="sm" className="h-auto" onClick={copy}>
              <Copy size={14} /> Copiar
            </Button>
          </div>
        </>
      )}
      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-amber-700">
        <Spinner className="h-4 w-4" /> Aguardando pagamento…
        {countdown && <span className="tabular-nums text-gray-500">expira em {countdown.label}</span>}
      </div>
      <p className="mt-1 text-xs text-gray-500">Esta página atualiza sozinha quando o Pix for confirmado.</p>
      <OrderLine order={order} />
    </Shell>
  )
}

function RetryButton({ order }: { order: PublicOrder }) {
  const router = useRouter()
  const retry = useMutation({
    mutationFn: () => checkoutService.retry(order.id),
    onSuccess: ({ checkoutUrl }) => router.push(checkoutUrl),
  })
  return (
    <>
      <Button size="lg" onClick={() => retry.mutate()} loading={retry.isPending}>
        Tentar novamente
      </Button>
      {retry.isError && <p className="text-sm text-red-600">{errorMessage(retry.error)}</p>}
    </>
  )
}

function Rejected({ order }: { order: PublicOrder }) {
  return (
    <Shell>
      <StatusIcon tone="danger">
        <XCircle size={30} />
      </StatusIcon>
      <h1 className="text-2xl font-bold text-gray-900">Pagamento não aprovado</h1>
      <p className="mt-2 text-gray-600">
        Nenhum valor foi cobrado. Isso pode acontecer por saldo, limite ou dados do cartão. Tente de novo ou use Pix.
      </p>
      <OrderLine order={order} />
      <div className="mt-6 grid gap-2">
        <RetryButton order={order} />
        <ButtonLink href="/pacotes" variant="ghost">
          Escolher outro kit
        </ButtonLink>
      </div>
    </Shell>
  )
}

function Expired({ order }: { order: PublicOrder }) {
  return (
    <Shell>
      <StatusIcon tone="neutral">
        <ReceiptText size={30} />
      </StatusIcon>
      <h1 className="text-2xl font-bold text-gray-900">Este Pix expirou</h1>
      <p className="mt-2 text-gray-600">O código ficou tempo demais sem pagamento. Gere um novo para continuar.</p>
      <OrderLine order={order} />
      <div className="mt-6 grid gap-2">
        <RetryButton order={order} />
      </div>
    </Shell>
  )
}

function Cancelled({ order }: { order: PublicOrder }) {
  return (
    <Shell>
      <StatusIcon tone="neutral">
        <Ban size={30} />
      </StatusIcon>
      <h1 className="text-2xl font-bold text-gray-900">Pedido cancelado</h1>
      <p className="mt-2 text-gray-600">
        {order.status === 'refunded' ? 'Este pedido foi reembolsado.' : 'Este pagamento foi contestado junto ao banco.'} O acesso ao kit foi encerrado.
      </p>
      <OrderLine order={order} />
      <div className="mt-6">
        <ButtonLink href="/#contato" variant="outline">
          Falar com a gente
        </ButtonLink>
      </div>
    </Shell>
  )
}

function Retorno() {
  const orderId = useSearchParams().get('pedido')
  const query = useQuery({
    queryKey: qk.publicOrder(orderId ?? ''),
    queryFn: () => checkoutService.getOrder(orderId!),
    enabled: !!orderId,
    // Enquanto pendente, consulta de novo a cada 3 s (no real: o webhook atualiza o pedido).
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 3000 : false),
  })

  if (!orderId)
    return (
      <Shell>
        <EmptyState icon={ReceiptText} title="Nenhum pedido informado" action={<ButtonLink href="/pacotes">Ver kits</ButtonLink>} />
      </Shell>
    )
  if (query.isPending) return <PageLoader label="Consultando seu pagamento…" />
  if (query.isError)
    return (
      <Shell>
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Shell>
    )

  const order = query.data
  switch (order.status) {
    case 'approved':
      return <Approved order={order} />
    case 'pending':
      return order.method === 'pix' ? (
        <PendingPix order={order} />
      ) : (
        <Shell>
          <StatusIcon tone="warning">
            <CheckCircle2 size={30} />
          </StatusIcon>
          <h1 className="text-2xl font-bold text-gray-900">Processando pagamento</h1>
          <p className="mt-2 text-gray-600">Estamos aguardando a confirmação. Esta página atualiza sozinha.</p>
          <OrderLine order={order} />
        </Shell>
      )
    case 'rejected':
      return <Rejected order={order} />
    default:
      return <Cancelled order={order} />
  }
}

export default function RetornoPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Retorno />
    </Suspense>
  )
}

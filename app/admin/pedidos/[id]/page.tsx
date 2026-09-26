'use client'

import { Button, ButtonLink, Card, ConfirmDialog, EntitlementBadge, OrderStatusBadge, PageHeader, PAYMENT_METHOD, QueryState, useToast } from '@/components/ui'
import { expiryText } from '@/lib/entitlements'
import { formatBRL, formatDateTime } from '@/lib/format'
import { devToolsEnabled } from '@/lib/dev/settings'
import { errorMessage, ordersService, qk } from '@/lib/services'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronLeft, FlaskConical, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right text-gray-900">{children}</dd>
    </div>
  )
}

const waLink = (phone: string) => `https://wa.me/55${phone.replace(/\D/g, '')}`

export default function PedidoPage({ params }: { params: { id: string } }) {
  const toast = useToast()
  const query = useQuery({ queryKey: qk.order(params.id), queryFn: () => ordersService.get(params.id) })
  const [confirm, setConfirm] = useState<'approve' | 'refund' | null>(null)

  const onDone = (msg: string) => () => {
    setConfirm(null)
    toast.success(msg)
  }
  const onFail = (err: unknown) => {
    setConfirm(null)
    toast.error(errorMessage(err))
  }
  const approve = useMutation({ mutationFn: () => ordersService.approve(params.id), onSuccess: onDone('Pagamento confirmado e acesso liberado.'), onError: onFail })
  const refund = useMutation({ mutationFn: () => ordersService.refund(params.id), onSuccess: onDone('Pedido reembolsado e acesso revogado.'), onError: onFail })
  const chargeback = useMutation({ mutationFn: () => ordersService.simulateChargeback(params.id), onSuccess: onDone('Chargeback simulado.'), onError: onFail })

  return (
    <QueryState query={query}>
      {({ order, package: pkg, customer, entitlement }) => (
        <>
          <PageHeader
            back={
              <Link href="/admin/pedidos" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                <ChevronLeft size={16} /> Pedidos
              </Link>
            }
            title={
              <span className="flex flex-wrap items-center gap-3">
                Pedido <span className="font-mono text-xl">{order.id}</span> <OrderStatusBadge status={order.status} />
              </span>
            }
            description={`Criado em ${formatDateTime(order.createdAt)}`}
            actions={
              <>
                {order.status === 'pending' && <Button onClick={() => setConfirm('approve')}>Confirmar pagamento</Button>}
                {order.status === 'approved' && (
                  <Button variant="outline" onClick={() => setConfirm('refund')}>
                    Reembolsar
                  </Button>
                )}
              </>
            }
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-semibold text-gray-900">Pagamento</h2>
              <dl className="mt-2 divide-y divide-black/5">
                <Row label="Valor">
                  <span className="font-semibold tabular-nums">{formatBRL(order.amountCents)}</span>
                </Row>
                <Row label="Método">{PAYMENT_METHOD[order.method]}</Row>
                <Row label="Pago em">{order.paidAt ? formatDateTime(order.paidAt) : '—'}</Row>
                <Row label="Pacote">{pkg ? <Link href={`/admin/pacotes/${pkg.id}`} className="text-brand-teal hover:underline">{pkg.title}</Link> : '—'}</Row>
              </dl>
              {order.status === 'pending' && (
                <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800">
                  Normalmente o Mercado Pago confirma sozinho. Use &quot;Confirmar pagamento&quot; só se você já verificou o recebimento no painel do Mercado Pago.
                </p>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold text-gray-900">Cliente</h2>
              <dl className="mt-2 divide-y divide-black/5">
                <Row label="Nome">{customer ? <Link href={`/admin/clientes/${customer.id}`} className="text-brand-teal hover:underline">{order.name}</Link> : order.name}</Row>
                <Row label="Email">{order.email}</Row>
                <Row label="WhatsApp">
                  <a href={waLink(order.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-teal hover:underline">
                    <MessageCircle size={14} /> {order.phone}
                  </a>
                </Row>
                <Row label="Conta">{customer ? 'Criada' : 'Ainda não (é criada quando o pagamento é aprovado)'}</Row>
              </dl>
            </Card>

            <Card className="p-5 lg:col-span-2">
              <h2 className="font-semibold text-gray-900">Acesso liberado</h2>
              {entitlement ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3">
                    <EntitlementBadge status={entitlement.status} />
                    <span className="text-gray-600">{expiryText(entitlement)}</span>
                  </div>
                  {customer && (
                    <ButtonLink href={`/admin/clientes/${customer.id}`} variant="ghost" size="sm">
                      Gerenciar acessos →
                    </ButtonLink>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500">Nenhum acesso ligado a este pedido.</p>
              )}
            </Card>

            {devToolsEnabled && order.status === 'approved' && (
              <Card className="p-5 lg:col-span-2 border-dashed">
                <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <FlaskConical size={16} /> Simulação
                </p>
                <p className="mt-1 text-xs text-gray-500">Simula o webhook de chargeback que o Mercado Pago enviaria.</p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => chargeback.mutate()} loading={chargeback.isPending}>
                  Simular chargeback
                </Button>
              </Card>
            )}
          </div>

          <ConfirmDialog
            open={confirm === 'approve'}
            onClose={() => setConfirm(null)}
            onConfirm={() => approve.mutate()}
            loading={approve.isPending}
            tone="primary"
            title="Confirmar pagamento manualmente?"
            description={`O acesso ao ${pkg?.title} será liberado para ${order.email} e o email de acesso será enviado.`}
            confirmLabel="Confirmar e liberar"
          />
          <ConfirmDialog
            open={confirm === 'refund'}
            onClose={() => setConfirm(null)}
            onConfirm={() => refund.mutate()}
            loading={refund.isPending}
            title={`Reembolsar ${formatBRL(order.amountCents)}?`}
            description="O valor será devolvido pelo Mercado Pago e o cliente perde o acesso a este kit."
            confirmLabel="Reembolsar"
          />
        </>
      )}
    </QueryState>
  )
}

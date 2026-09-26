'use client'

import { ButtonLink, Card, EmptyState, OrderStatusBadge, PageHeader, PAYMENT_METHOD, QueryState, Table, TBody, TD, TH, THead, TR } from '@/components/ui'
import { formatBRL, formatDate } from '@/lib/format'
import { accountService, qk } from '@/lib/services'
import { useQuery } from '@tanstack/react-query'
import { ReceiptText } from 'lucide-react'

export default function PedidosPage() {
  const query = useQuery({ queryKey: qk.myOrders, queryFn: accountService.myOrders })

  return (
    <>
      <PageHeader title="Pedidos" description="Histórico das suas compras." />
      <QueryState
        query={query}
        empty={
          <Card>
            <EmptyState icon={ReceiptText} title="Nenhum pedido ainda" action={<ButtonLink href="/pacotes">Ver kits</ButtonLink>} />
          </Card>
        }
      >
        {(orders) => (
          <>
            {/* Celular: cartões */}
            <div className="grid gap-3 sm:hidden">
              {orders.map((o) => (
                <Card key={o.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{o.packageTitle}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(o.createdAt)} · {PAYMENT_METHOD[o.method]}
                      </p>
                    </div>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-gray-400">{o.id}</span>
                    <span className="font-semibold tabular-nums">{formatBRL(o.amountCents)}</span>
                  </div>
                </Card>
              ))}
            </div>
            {/* Desktop: tabela */}
            <div className="hidden sm:block">
              <Table>
                <THead>
                  <tr>
                    <TH>Data</TH>
                    <TH>Kit</TH>
                    <TH>Pagamento</TH>
                    <TH className="text-right">Valor</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <TBody>
                  {orders.map((o) => (
                    <TR key={o.id}>
                      <TD className="whitespace-nowrap">{formatDate(o.createdAt)}</TD>
                      <TD>
                        <p className="font-medium text-gray-900">{o.packageTitle}</p>
                        <p className="font-mono text-xs text-gray-400">{o.id}</p>
                      </TD>
                      <TD>{PAYMENT_METHOD[o.method]}</TD>
                      <TD className="text-right tabular-nums">{formatBRL(o.amountCents)}</TD>
                      <TD>
                        <OrderStatusBadge status={o.status} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </>
        )}
      </QueryState>
    </>
  )
}

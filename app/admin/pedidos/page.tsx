'use client'

import { Button, Card, EmptyState, Input, ORDER_STATUS, OrderStatusBadge, PageHeader, PageLoader, PAYMENT_METHOD, QueryState, Select, Table, TBody, TD, TH, THead, TR, useToast } from '@/components/ui'
import { formatBRL, formatDateTime } from '@/lib/format'
import { errorMessage, ordersService, qk } from '@/lib/services'
import type { OrderFilters } from '@/lib/services/orders'
import type { OrderStatus } from '@/lib/types'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ReceiptText, RefreshCw, Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function Pedidos() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const status = (params.get('status') ?? 'all') as OrderFilters['status']
  const days = Number(params.get('dias') ?? 0) || undefined
  const [search, setSearch] = useState(params.get('q') ?? '')
  const debounced = useDebounced(search)

  // Filtros ficam na URL para poder compartilhar/voltar.
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.replace(`${pathname}?${next.toString()}`)
  }
  useEffect(() => {
    if ((params.get('q') ?? '') !== debounced) setParam('q', debounced || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const toast = useToast()
  const reconcile = useMutation({
    mutationFn: ordersService.reconcilePending,
    onSuccess: ({ checked, updated }) =>
      toast.success(checked ? `${checked} pendentes verificados no Mercado Pago; ${updated} atualizados.` : 'Nenhum pedido pendente para verificar.'),
    onError: (err) => toast.error(errorMessage(err)),
  })
  const filters: OrderFilters = { status, days, search: debounced }
  const query = useQuery({ queryKey: qk.orders(filters), queryFn: () => ordersService.list(filters), placeholderData: (prev) => prev })
  const total = query.data?.filter((o) => o.status === 'approved').reduce((s, o) => s + o.amountCents, 0) ?? 0

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Todos os pedidos, pagos ou não."
        actions={
          <Button variant="ghost" onClick={() => reconcile.mutate()} loading={reconcile.isPending}>
            <RefreshCw size={16} /> Verificar pendentes no Mercado Pago
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px_160px]">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, email ou nº do pedido" className="pl-10" />
        </div>
        <Select value={status} onChange={(e) => setParam('status', e.target.value === 'all' ? null : e.target.value)} aria-label="Status">
          <option value="all">Todos os status</option>
          {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS[s].label}
            </option>
          ))}
        </Select>
        <Select value={days ?? ''} onChange={(e) => setParam('dias', e.target.value || null)} aria-label="Período">
          <option value="">Todo o período</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </Select>
      </div>

      <QueryState
        query={query}
        empty={
          <Card>
            <EmptyState icon={ReceiptText} title="Nenhum pedido encontrado" description="Ajuste os filtros ou a busca." />
          </Card>
        }
      >
        {(orders) => (
          <>
            <p className="mb-2 text-sm text-gray-500">
              {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'} · {formatBRL(total)} aprovados
            </p>
            <Table>
              <THead>
                <tr>
                  <TH>Pedido</TH>
                  <TH>Cliente</TH>
                  <TH>Pacote</TH>
                  <TH>Pagamento</TH>
                  <TH className="text-right">Valor</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {orders.map((o) => (
                  <TR key={o.id} onClick={() => router.push(`/admin/pedidos/${o.id}`)}>
                    <TD>
                      <p className="font-mono text-xs text-gray-900">{o.id}</p>
                      <p className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(o.createdAt)}</p>
                    </TD>
                    <TD>
                      <p className="font-medium text-gray-900 whitespace-nowrap">{o.name}</p>
                      <p className="text-xs text-gray-500">{o.email}</p>
                    </TD>
                    <TD className="whitespace-nowrap">{o.packageTitle}</TD>
                    <TD>{PAYMENT_METHOD[o.method]}</TD>
                    <TD className="text-right tabular-nums whitespace-nowrap">{formatBRL(o.amountCents)}</TD>
                    <TD>
                      <OrderStatusBadge status={o.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </>
        )}
      </QueryState>
    </>
  )
}

export default function PedidosAdminPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Pedidos />
    </Suspense>
  )
}

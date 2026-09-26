'use client'

import { RevenueChart } from '@/components/admin/RevenueChart'
import { Card, ErrorState, ORDER_STATUS, OrderStatusBadge, PageHeader, Skeleton, StatCard } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatBRL, formatDateTime } from '@/lib/format'
import { dashboardService, ordersService, qk } from '@/lib/services'
import type { OrderStatus } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

const PERIODS = [7, 30, 90] as const

function Delta({ current, previous }: { current: number; previous: number }) {
  if (!previous) return <span className="text-gray-400">sem dados do período anterior</span>
  const pct = Math.round(((current - previous) / previous) * 100)
  const up = pct >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center gap-0.5', up ? 'text-emerald-700' : 'text-red-700')}>
      <Icon size={14} /> {up ? '+' : ''}
      {pct}% vs. período anterior
    </span>
  )
}

export default function DashboardPage() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30)
  const stats = useQuery({ queryKey: qk.dashboard(days), queryFn: () => dashboardService.stats(days) })
  const recent = useQuery({ queryKey: qk.orders({ recent: true }), queryFn: () => ordersService.list({}) })

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Resumo das vendas."
        actions={
          <div className="inline-flex rounded-2xl bg-white p-1 shadow-sm ring-1 ring-black/5">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setDays(p)}
                className={cn('rounded-xl px-3 py-1.5 text-sm', days === p ? 'bg-brand-blush text-brand-coral-dark font-medium' : 'text-gray-600 hover:bg-black/5')}
              >
                {p} dias
              </button>
            ))}
          </div>
        }
      />

      {stats.isError ? (
        <Card>
          <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {stats.isPending ? (
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[104px] rounded-3xl" />)
            ) : (
              <>
                <StatCard
                  label={`Receita (${days} dias)`}
                  value={formatBRL(stats.data.revenueCents)}
                  hint={<Delta current={stats.data.revenueCents} previous={stats.data.previousRevenueCents} />}
                />
                <StatCard label="Pedidos pagos" value={stats.data.paidOrders} />
                <StatCard
                  label="Aguardando pagamento"
                  value={stats.data.pendingOrders}
                  hint={stats.data.pendingOrders ? <Link href="/admin/pedidos?status=pending" className="text-brand-teal">Ver pendentes →</Link> : 'Nenhum pendente'}
                />
                <StatCard label="Clientes novos" value={stats.data.newCustomers} />
              </>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <Card className="p-5">
              <h2 className="font-semibold text-gray-900">Receita por dia</h2>
              {stats.isPending ? <Skeleton className="mt-4 h-48" /> : <RevenueChart data={stats.data.daily} />}
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold text-gray-900">Pedidos no período</h2>
              {stats.isPending ? (
                <Skeleton className="mt-4 h-40" />
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => (
                    <li key={s} className="flex items-center justify-between text-sm">
                      <OrderStatusBadge status={s} />
                      <span className="tabular-nums font-medium text-gray-900">{stats.data.byStatus[s]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-semibold text-gray-900">Pacotes mais vendidos</h2>
              {stats.isPending ? (
                <Skeleton className="mt-4 h-32" />
              ) : stats.data.topPackages.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">Nenhuma venda no período.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {stats.data.topPackages.map((p) => {
                    const max = stats.data.topPackages[0].revenueCents
                    return (
                      <li key={p.id}>
                        <div className="flex items-center justify-between text-sm">
                          <Link href={`/admin/pacotes/${p.id}`} className="font-medium text-gray-800 hover:underline truncate">
                            {p.title}
                          </Link>
                          <span className="tabular-nums text-gray-600 shrink-0 ml-3">
                            {p.sales} · {formatBRL(p.revenueCents)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-[#35999A]" style={{ width: `${(p.revenueCents / max) * 100}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Últimos pedidos</h2>
                <Link href="/admin/pedidos" className="text-sm text-brand-teal">
                  Ver todos
                </Link>
              </div>
              {recent.isPending ? (
                <Skeleton className="mt-4 h-40" />
              ) : recent.isError ? (
                <p className="mt-4 text-sm text-red-600">Não foi possível carregar.</p>
              ) : recent.data.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">Nenhum pedido ainda.</p>
              ) : (
                <ul className="mt-3 divide-y divide-black/5">
                  {recent.data.slice(0, 5).map((o) => (
                    <li key={o.id}>
                      <Link href={`/admin/pedidos/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-brand-sand/40 -mx-2 px-2 rounded-xl">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{o.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {o.packageTitle} · {formatDateTime(o.createdAt)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm tabular-nums">{formatBRL(o.amountCents)}</p>
                          <OrderStatusBadge status={o.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  )
}

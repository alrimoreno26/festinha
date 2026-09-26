'use client'

import { formatBRL } from '@/lib/format'
import { useState } from 'react'

interface Point {
  date: string
  revenueCents: number
  orders: number
}

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

/** Barras de receita diária (uma série, um eixo). Hover mostra o valor do dia. */
export function RevenueChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.revenueCents), 1)
  // Linha de referência "redonda" para o eixo (ex.: R$ 100, R$ 200…).
  const step = Math.pow(10, Math.floor(Math.log10(max / 100))) * 100
  const top = Math.ceil(max / step) * step
  const labelEvery = Math.ceil(data.length / 6)
  const active = hover !== null ? data[hover] : null

  return (
    <div className="relative">
      <div className="h-6 text-sm text-gray-600" aria-live="polite">
        {active ? (
          <>
            <span className="font-medium text-gray-900">{shortDate.format(new Date(active.date))}</span> · {formatBRL(active.revenueCents)} ·{' '}
            {active.orders} {active.orders === 1 ? 'pedido' : 'pedidos'}
          </>
        ) : (
          <span className="text-gray-400">Passe o mouse ou toque nas barras para ver o dia</span>
        )}
      </div>
      <div className="relative mt-2 flex gap-2">
        {/* Eixo Y: topo, meio e zero (alinhados às linhas de grade) */}
        <div className="flex flex-col justify-between h-40 text-[11px] text-gray-400 tabular-nums text-right w-14 shrink-0 -mt-1.5 pb-0">
          <span>{formatBRL(top).replace(',00', '')}</span>
          <span>{formatBRL(top / 2).replace(',00', '')}</span>
          <span>R$ 0</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative h-40 border-b border-gray-200" onMouseLeave={() => setHover(null)}>
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-100" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-100" />
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {data.map((d, i) => (
                <div
                  key={d.date}
                  className="relative flex-1 h-full flex items-end cursor-default"
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  tabIndex={0}
                  aria-label={`${shortDate.format(new Date(d.date))}: ${formatBRL(d.revenueCents)}`}
                >
                  <div
                    className="w-full rounded-t-[4px] transition-opacity"
                    style={{
                      height: d.revenueCents ? `${Math.max(2, (d.revenueCents / top) * 100)}%` : 0,
                      background: '#35999A',
                      opacity: hover === null || hover === i ? 1 : 0.45,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex text-[11px] text-gray-400">
            {data.map((d, i) => (
              <span key={d.date} className="flex-1 text-center overflow-visible whitespace-nowrap">
                {i % labelEvery === 0 ? shortDate.format(new Date(d.date)) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Visão em tabela para leitores de tela. O sr-only fica num div: tabelas ignoram width/overflow
          e, sozinhas, continuariam ocupando altura invisível na página. */}
      <div className="sr-only">
        <table>
          <caption>Receita por dia</caption>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Receita</th>
              <th>Pedidos</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}>
                <td>{shortDate.format(new Date(d.date))}</td>
                <td>{formatBRL(d.revenueCents)}</td>
                <td>{d.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

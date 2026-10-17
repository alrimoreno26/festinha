'use client'

import {
  Button,
  ButtonLink,
  Card,
  DELIVERY_METHOD,
  EmptyState,
  FileIcon,
  KindBadge,
  OrderStatusBadge,
  PageHeader,
  PAYMENT_METHOD,
  ProductionBadge,
  QueryState,
  useToast,
} from '@/components/ui'
import { addressLines, trackingUrl } from '@/lib/address'
import { triggerDownload } from '@/lib/download'
import { formatBRL, formatBytes, formatDate } from '@/lib/format'
import { accountService, errorMessage, qk } from '@/lib/services'
import type { KitFile, MyOrder } from '@/lib/services/account'
import { useQuery } from '@tanstack/react-query'
import { Check, Download, ReceiptText } from 'lucide-react'
import { useState } from 'react'

/** Texto do andamento para o cliente, conforme o tipo do pedido. */
function progressText(o: MyOrder) {
  if (o.status !== 'approved' || !o.productionStatus) return null
  if (o.productionStatus === 'delivered')
    return o.packageKind === 'custom_digital' ? 'Sua arte está pronta! Baixe os arquivos abaixo.' : 'Pedido entregue. Boa festa! 🎉'
  if (o.productionStatus === 'ready')
    return o.deliveryMethod === 'shipping' ? 'Seu pedido foi enviado! Acompanhe pelo rastreio abaixo.' : 'Pronto para retirada! Vamos combinar o horário pelo WhatsApp.'
  return o.packageKind === 'printed' ? 'Estamos produzindo seu kit com muito carinho.' : 'Estamos criando sua arte com muito carinho.'
}

function OrderFiles({ files }: { files: KitFile[] }) {
  const toast = useToast()
  const [states, setStates] = useState<Record<string, 'loading' | 'done'>>({})
  const download = async (file: KitFile) => {
    setStates((s) => ({ ...s, [file.id]: 'loading' }))
    try {
      const { url, filename } = await accountService.getDownloadUrl(file.id)
      triggerDownload(url, filename)
      setStates((s) => ({ ...s, [file.id]: 'done' }))
    } catch (err) {
      setStates(({ [file.id]: _, ...rest }) => rest)
      toast.error(errorMessage(err))
    }
  }
  return (
    <ul className="mt-3 divide-y divide-black/5 rounded-2xl border border-black/5">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 px-3 py-2">
          <FileIcon mime={f.mime} className="h-8 w-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-gray-800">{f.filename}</p>
            <p className="text-xs text-gray-400">{formatBytes(f.size)}</p>
          </div>
          <Button size="sm" variant={states[f.id] === 'done' ? 'ghost' : 'primary'} loading={states[f.id] === 'loading'} onClick={() => download(f)}>
            {states[f.id] === 'done' ? <Check size={14} /> : <Download size={14} />} {states[f.id] === 'done' ? 'Baixado' : 'Baixar'}
          </Button>
        </li>
      ))}
    </ul>
  )
}

function OrderCard({ order: o }: { order: MyOrder }) {
  const progress = progressText(o)
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-gray-900">{o.packageTitle}</p>
            {o.packageKind !== 'digital' && <KindBadge kind={o.packageKind} />}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatDate(o.createdAt)} · {PAYMENT_METHOD[o.method]} · <span className="font-mono">{o.id}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {o.productionStatus && o.status === 'approved' ? <ProductionBadge status={o.productionStatus} /> : <OrderStatusBadge status={o.status} />}
          <span className="font-semibold tabular-nums">{formatBRL(o.amountCents)}</span>
        </div>
      </div>

      {progress && <p className="mt-3 rounded-2xl bg-brand-blush px-4 py-2.5 text-sm text-brand-ink">{progress}</p>}
      {o.packageKind === 'printed' && o.status === 'approved' && (
        <div className="mt-2 text-xs text-gray-500">
          <p>
            {DELIVERY_METHOD[o.deliveryMethod]}
            {o.shipping && ` · ${[o.shipping.company, o.shipping.service].filter(Boolean).join(' ')} (${formatBRL(o.shipping.priceCents)})`}
          </p>
          {o.shippingAddress && <p>{addressLines(o.shippingAddress).join(' · ')}</p>}
          {o.trackingCode && (
            <a href={trackingUrl(o.trackingCode)} target="_blank" rel="noreferrer" className="mt-1 inline-flex font-semibold text-brand-grape hover:underline">
              Rastrear: {o.trackingCode}
            </a>
          )}
        </div>
      )}
      {o.files.length > 0 && <OrderFiles files={o.files} />}
    </Card>
  )
}

export default function PedidosPage() {
  const query = useQuery({ queryKey: qk.myOrders, queryFn: accountService.myOrders })

  return (
    <>
      <PageHeader title="Pedidos" description="Suas compras e o andamento dos pedidos personalizados." />
      <QueryState
        query={query}
        empty={
          <Card>
            <EmptyState icon={ReceiptText} title="Nenhum pedido ainda" action={<ButtonLink href="/pacotes">Ver kits</ButtonLink>} />
          </Card>
        }
      >
        {(orders) => (
          <div className="grid gap-3">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        )}
      </QueryState>
    </>
  )
}

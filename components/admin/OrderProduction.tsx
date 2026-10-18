'use client'

// Pedidos sob encomenda no backoffice: o que o cliente pediu, como recebe e o andamento da produção
// (no personalizado digital, também o envio do arquivo final).

import { Button, Card, DELIVERY_METHOD, Dropzone, Field, FileIcon, Input, ProductionBadge, PRODUCTION_STATUS, Spinner, useToast } from '@/components/ui'
import { addressLines } from '@/lib/address'
import { formatBytes } from '@/lib/format'
import { errorMessage, filesService, ordersService, qk } from '@/lib/services'
import type { AdminOrderDetail } from '@/lib/services/orders'
import type { Customization, FileItem, ProductionStatus } from '@/lib/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Download, X } from 'lucide-react'
import { triggerDownload } from '@/lib/download'
import { useState } from 'react'

const FIELDS: { key: keyof Customization; label: string }[] = [
  { key: 'businessName', label: 'Empresa/marca' },
  { key: 'cardText', label: 'Textos do cartão' },
  { key: 'childName', label: 'Nome na arte' },
  { key: 'age', label: 'Idade' },
  { key: 'theme', label: 'Tema' },
  { key: 'colors', label: 'Cores' },
  { key: 'notes', label: 'Observações' },
]

/** Arquivos que o cliente enviou no checkout (ex.: logo), para baixar. */
export function CustomerFilesCard({ files }: { files: FileItem[] }) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const download = async (file: FileItem) => {
    setBusy(file.id)
    try {
      const { url, filename } = await ordersService.downloadFile(file.id)
      triggerDownload(url, filename)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }
  return (
    <Card className="p-5">
      <h2 className="font-semibold text-gray-900">Arquivos do cliente</h2>
      <p className="text-sm text-gray-500">Logo e referências enviados no checkout.</p>
      <ul className="mt-3 divide-y divide-black/5 rounded-2xl border border-black/5">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-3 px-3 py-2">
            <FileIcon mime={f.mime} className="h-8 w-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-gray-800">{f.filename}</p>
              <p className="text-xs text-gray-400">{formatBytes(f.size)}</p>
            </div>
            <Button size="sm" variant="outline" loading={busy === f.id} onClick={() => download(f)}>
              <Download size={14} /> Baixar
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function CustomizationCard({ customization }: { customization: Customization }) {
  const toast = useToast()
  const filled = FIELDS.filter((f) => customization[f.key])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(filled.map((f) => `${f.label}: ${customization[f.key]}`).join('\n'))
      toast.success('Detalhes copiados.')
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">Personalização</h2>
        {filled.length > 0 && (
          <Button variant="ghost" size="sm" onClick={copy}>
            <Copy size={14} /> Copiar
          </Button>
        )}
      </div>
      {filled.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">O cliente não informou detalhes.</p>
      ) : (
        <dl className="mt-2 divide-y divide-black/5">
          {filled.map((f) => (
            <div key={f.key} className="py-2.5 text-sm">
              <dt className="text-gray-500">{f.label}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-gray-900">{customization[f.key]}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  )
}

const STEPS: Record<'custom_digital' | 'printed', ProductionStatus[]> = {
  custom_digital: ['in_production', 'delivered'],
  printed: ['in_production', 'ready', 'delivered'],
}

const NEXT_LABEL: Record<ProductionStatus, string> = {
  in_production: 'Voltar para produção',
  ready: 'Marcar como pronto (avisa o cliente)',
  delivered: 'Marcar como entregue',
}

export function ProductionCard({ detail }: { detail: AdminOrderDetail }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { order, package: pkg, files } = detail
  const kind = pkg?.kind === 'printed' ? 'printed' : 'custom_digital'
  const steps = STEPS[kind]
  const current = order.productionStatus
  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null)
  const shipped = kind === 'printed' && order.deliveryMethod === 'shipping'
  const [tracking, setTracking] = useState(order.trackingCode ?? '')
  // "Pronto" significa "despachado" quando o pedido vai pelos Correios/transportadora.
  const stepLabel = (s: ProductionStatus) => (shipped && s === 'ready' ? 'Enviado' : PRODUCTION_STATUS[s].label)

  const refresh = (data: AdminOrderDetail) => {
    queryClient.setQueryData(qk.order(order.id), data)
    queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
  }

  const update = useMutation({
    mutationFn: ({ status, fileIds, trackingCode }: { status: ProductionStatus; fileIds?: string[]; trackingCode?: string }) =>
      ordersService.updateProduction(order.id, status, fileIds, trackingCode),
    onSuccess: (data, { status }) => {
      refresh(data)
      toast.success(
        status === 'delivered' && kind === 'custom_digital'
          ? 'Pedido entregue: o cliente foi avisado por email.'
          : status === 'ready'
            ? shipped
              ? 'Pedido enviado: o cliente recebeu o rastreio por email.'
              : 'Pedido pronto: o cliente foi avisado por email.'
            : status === current
              ? 'Código de rastreio atualizado.'
              : `Etapa: ${stepLabel(status)}.`,
      )
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const detach = useMutation({
    mutationFn: (fileId: string) => ordersService.detachFile(order.id, fileId),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  })

  /** Envia ao bucket na pasta do pedido e anexa, sem mudar a etapa. */
  const upload = async (list: File[]) => {
    const ids: string[] = []
    try {
      for (const file of list) {
        setUploading({ name: file.name, progress: 0 })
        const item = await filesService.upload(file, `pedidos/${order.id}`, (progress) => setUploading({ name: file.name, progress }))
        ids.push(item.id)
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'files'] })
      refresh(await ordersService.updateProduction(order.id, current ?? 'in_production', ids))
      toast.success(ids.length > 1 ? `${ids.length} arquivos anexados.` : 'Arquivo anexado.')
    } catch (err) {
      toast.error(errorMessage(err))
      // Os que já subiram ficam anexados mesmo que um falhe no meio.
      if (ids.length) refresh(await ordersService.updateProduction(order.id, current ?? 'in_production', ids).catch(() => detail))
    } finally {
      setUploading(null)
    }
  }

  if (order.status !== 'approved' || !current) {
    return (
      <Card className="p-5 lg:col-span-2">
        <h2 className="font-semibold text-gray-900">Produção</h2>
        <p className="mt-2 text-sm text-gray-500">A produção começa quando o pagamento é aprovado.</p>
      </Card>
    )
  }

  const index = steps.indexOf(current)
  const next = steps[index + 1]
  const needsFile = kind === 'custom_digital' && next === 'delivered' && files.length === 0

  return (
    <Card className="p-5 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">Produção</h2>
        <ProductionBadge status={current} />
      </div>

      <ol className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-6 bg-gray-300" aria-hidden />}
            <span
              className={
                i < index
                  ? 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700'
                  : i === index
                    ? 'inline-flex items-center gap-1 rounded-full bg-brand-blush px-3 py-1 font-semibold text-brand-rose-dark'
                    : 'inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-gray-500'
              }
            >
              {i < index && <Check size={14} />} {stepLabel(s)}
            </span>
          </li>
        ))}
      </ol>

      {kind === 'custom_digital' && (
        <div className="mt-5">
          <p className="text-sm font-medium text-gray-700">Arquivos finais para o cliente</p>
          {files.length > 0 && (
            <ul className="mt-2 divide-y divide-black/5 rounded-2xl border border-black/5">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-3 py-2">
                  <FileIcon mime={f.mime} className="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-800">{f.filename}</p>
                    <p className="text-xs text-gray-400">{formatBytes(f.size)}</p>
                  </div>
                  {current !== 'delivered' && (
                    <button
                      type="button"
                      onClick={() => detach.mutate(f.id)}
                      disabled={detach.isPending}
                      className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Tirar ${f.filename} do pedido`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {uploading ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-gray-50 p-3 text-sm text-gray-700">
              <Spinner className="h-4 w-4" />
              <span className="truncate">
                Enviando {uploading.name}… {uploading.progress}%
              </span>
            </div>
          ) : (
            <Dropzone
              className="mt-3"
              onFiles={upload}
              title="Arraste o arquivo final ou clique para escolher"
              hint={`Fica na pasta pedidos/${order.id} e só este cliente consegue baixar.`}
            />
          )}
        </div>
      )}

      {kind === 'printed' && (
        <div className="mt-4 space-y-3 text-sm text-gray-600">
          <p>
            <strong className="text-gray-800">{DELIVERY_METHOD[order.deliveryMethod]}</strong>
            {order.shipping && ` · ${[order.shipping.company, order.shipping.service].filter(Boolean).join(' ')}`}
            {order.deliveryMethod === 'pickup' && ': combine o horário pelo WhatsApp quando estiver pronto.'}
          </p>
          {shipped && order.shippingAddress && (
            <div className="rounded-2xl bg-gray-50 p-3 text-gray-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Enviar para</p>
              <p className="mt-1 font-medium">{order.name}</p>
              {addressLines(order.shippingAddress).map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p className="mt-2 text-xs text-gray-500">Compre a etiqueta no painel do Melhor Envio com este endereço e cole o código de rastreio abaixo.</p>
            </div>
          )}
          {shipped && current !== 'delivered' && (
            <Field label="Código de rastreio" hint="Vai no email de envio para o cliente acompanhar.">
              <Input value={tracking} onChange={(e) => setTracking(e.target.value.toUpperCase())} placeholder="Ex.: AA123456789BR" maxLength={60} />
            </Field>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {next && (
          <Button
            onClick={() => update.mutate({ status: next, trackingCode: shipped ? tracking.trim() || undefined : undefined })}
            loading={update.isPending}
            disabled={needsFile || !!uploading || (shipped && next === 'ready' && !tracking.trim())}
          >
            {shipped && next === 'ready' ? 'Marcar como enviado (avisa o cliente)' : NEXT_LABEL[next]}
          </Button>
        )}
        {shipped && current === 'ready' && tracking.trim() && tracking.trim() !== (order.trackingCode ?? '') && (
          <Button variant="outline" onClick={() => update.mutate({ status: 'ready', trackingCode: tracking.trim() })} disabled={update.isPending}>
            Salvar código de rastreio
          </Button>
        )}
        {index > 0 && current !== 'delivered' && (
          <Button variant="ghost" onClick={() => update.mutate({ status: steps[index - 1] })} disabled={update.isPending}>
            Voltar etapa
          </Button>
        )}
      </div>
      {needsFile && <p className="mt-2 text-xs text-gray-500">Envie o arquivo final para poder entregar.</p>}
      {shipped && next === 'ready' && !tracking.trim() && <p className="mt-2 text-xs text-gray-500">Informe o código de rastreio para marcar como enviado.</p>}
    </Card>
  )
}

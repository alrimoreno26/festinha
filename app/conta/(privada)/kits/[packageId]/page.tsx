'use client'

import { PackageCover } from '@/components/catalog/PackageCard'
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  EntitlementBadge,
  ErrorState,
  FileIcon,
  fileKind,
  PageLoader,
  useToast,
} from '@/components/ui'
import { triggerDownload } from '@/lib/download'
import { canDownload, expiryText } from '@/lib/entitlements'
import { formatBytes } from '@/lib/format'
import { accountService, errorMessage, qk, ServiceError } from '@/lib/services'
import type { KitFile, MyKitDetail } from '@/lib/services/account'
import { useQuery } from '@tanstack/react-query'
import { Ban, CalendarX2, Check, ChevronLeft, Download, Lightbulb, SearchX } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

type DownloadState = 'idle' | 'loading' | 'done'

function Blocked({ kit }: { kit: MyKitDetail }) {
  if (kit.status === 'expired')
    return (
      <EmptyState
        icon={CalendarX2}
        title="O acesso a este kit venceu"
        description={`${expiryText(kit.entitlement)}. Compre novamente para liberar os downloads por mais um período.`}
        action={kit.package.slug ? <ButtonLink href={`/pacotes/${kit.package.slug}`}>Comprar novamente</ButtonLink> : undefined}
      />
    )
  return (
    <EmptyState
      icon={Ban}
      title="O acesso a este kit foi encerrado"
      description="Isso acontece quando o pagamento é reembolsado ou contestado. Se acha que é um engano, fale com a gente."
      action={
        <ButtonLink href="https://wa.me/5548991056244" target="_blank" variant="outline">
          Falar no WhatsApp
        </ButtonLink>
      }
    />
  )
}

export default function KitPage({ params }: { params: { packageId: string } }) {
  const toast = useToast()
  const query = useQuery({ queryKey: qk.myKit(params.packageId), queryFn: () => accountService.myKit(params.packageId) })
  const [states, setStates] = useState<Record<string, DownloadState>>({})
  const [downloadingAll, setDownloadingAll] = useState(false)

  const download = async (file: KitFile) => {
    setStates((s) => ({ ...s, [file.id]: 'loading' }))
    try {
      const { url, filename } = await accountService.getDownloadUrl(file.id)
      triggerDownload(url, filename)
      setStates((s) => ({ ...s, [file.id]: 'done' }))
      return true
    } catch (err) {
      setStates((s) => ({ ...s, [file.id]: 'idle' }))
      toast.error(errorMessage(err))
      return false
    }
  }

  const downloadAll = async (files: KitFile[]) => {
    setDownloadingAll(true)
    for (const file of files) {
      if (!(await download(file))) break
      await new Promise((r) => setTimeout(r, 400))
    }
    setDownloadingAll(false)
  }

  const back = (
    <Link href="/conta" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
      <ChevronLeft size={16} /> Meus kits
    </Link>
  )

  if (query.isPending) return <PageLoader />
  if (query.isError) {
    const notFound = query.error instanceof ServiceError && query.error.code === 'NOT_FOUND'
    return (
      <>
        {back}
        <Card className="mt-4">
          {notFound ? (
            <EmptyState icon={SearchX} title="Kit não encontrado" description={errorMessage(query.error)} action={<ButtonLink href="/conta">Voltar para meus kits</ButtonLink>} />
          ) : (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          )}
        </Card>
      </>
    )
  }

  const kit = query.data
  const available = canDownload(kit.status)
  const totalSize = kit.files.reduce((s, f) => s + f.size, 0)

  return (
    <>
      {back}
      <Card className="mt-4 overflow-hidden">
        <div className="grid sm:grid-cols-[220px_1fr]">
          <PackageCover src={kit.package.coverUrl} alt={kit.package.title} className="h-44 sm:h-full w-full" />
          <div className="p-5 sm:p-6">
            <EntitlementBadge status={kit.status} />
            <h1 className="mt-2 text-2xl font-bold text-brand-cocoa">{kit.package.title}</h1>
            <p className="mt-1 text-sm text-gray-600">{kit.package.description}</p>
            <p className={kit.status === 'expiring' ? 'mt-3 text-sm font-medium text-amber-700' : 'mt-3 text-sm text-gray-500'}>
              {expiryText(kit.entitlement)}
            </p>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        {!available ? (
          <Blocked kit={kit} />
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-black/5 p-5">
              <div>
                <h2 className="font-semibold text-gray-900">Arquivos</h2>
                <p className="text-xs text-gray-500">
                  {kit.files.length} arquivos · {formatBytes(totalSize)}
                </p>
              </div>
              <Button variant="secondary" onClick={() => downloadAll(kit.files)} loading={downloadingAll} disabled={!kit.files.length}>
                <Download size={16} /> Baixar tudo
              </Button>
            </div>
            <ul className="divide-y divide-black/5">
              {kit.files.map((file) => {
                const state = states[file.id] ?? 'idle'
                return (
                  <li key={file.id} className="flex items-center gap-3 px-5 py-3">
                    <FileIcon mime={file.mime} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">{file.filename}</p>
                      <p className="text-xs text-gray-500">
                        {fileKind(file.mime).label} · {formatBytes(file.size)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={state === 'done' ? 'ghost' : 'outline'}
                      loading={state === 'loading'}
                      onClick={() => download(file)}
                      aria-label={`Baixar ${file.filename}`}
                    >
                      {state === 'done' ? (
                        <>
                          <Check size={14} className="text-emerald-600" /> <span className="hidden sm:inline">Baixado</span>
                        </>
                      ) : (
                        <>
                          <Download size={14} /> <span className="hidden sm:inline">Baixar</span>
                        </>
                      )}
                    </Button>
                  </li>
                )
              })}
            </ul>
            {kit.files.length === 0 && <EmptyState title="Este kit ainda não tem arquivos" description="Estamos preparando os arquivos. Volte em breve." />}
          </>
        )}
      </Card>

      {available && (
        <div className="mt-6 flex items-start gap-3 rounded-3xl bg-white/70 border border-black/5 p-4 text-sm text-gray-600">
          <Lightbulb size={18} className="shrink-0 mt-0.5 text-brand-sun" />
          <p>
            Dica: imprima em papel fotográfico ou de gramatura 180g ou mais, com a opção &quot;tamanho real&quot; (100%) para as medidas ficarem certas.
          </p>
        </div>
      )}
    </>
  )
}

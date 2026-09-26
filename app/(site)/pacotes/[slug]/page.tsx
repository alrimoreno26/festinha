'use client'

import { PackageCover } from '@/components/catalog/PackageCard'
import { ButtonLink, Card, EmptyState, ErrorState, FileIcon, fileKind, Skeleton } from '@/components/ui'
import { accessLabel, formatBRL, formatBytes } from '@/lib/format'
import { packagesService, qk, ServiceError } from '@/lib/services'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, ChevronLeft, CreditCard, SearchX, Zap } from 'lucide-react'
import Link from 'next/link'

const faq = [
  { q: 'Como recebo os arquivos?', a: 'Assim que o pagamento é confirmado, enviamos por email seus dados de acesso à Área do Cliente, onde você baixa tudo.' },
  { q: 'Preciso de impressora especial?', a: 'Não. Os arquivos funcionam em impressoras caseiras. Para melhor acabamento, use papel fotográfico ou de gramatura 180g ou mais.' },
  { q: 'O pagamento por Pix demora?', a: 'Normalmente é confirmado em segundos. A página atualiza sozinha quando o Pix cair.' },
]

export default function PacotePage({ params }: { params: { slug: string } }) {
  const query = useQuery({
    queryKey: qk.publicPackage(params.slug),
    queryFn: () => packagesService.getPublicBySlug(params.slug),
  })

  const back = (
    <Link href="/pacotes" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
      <ChevronLeft size={16} /> Todos os kits
    </Link>
  )

  if (query.isPending) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        {back}
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-[4/3] rounded-3xl" />
          <div className="space-y-4">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-12 w-40 mt-6" />
          </div>
        </div>
      </main>
    )
  }

  if (query.isError) {
    const notFound = query.error instanceof ServiceError && query.error.code === 'NOT_FOUND'
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        {back}
        <Card className="mt-6">
          {notFound ? (
            <EmptyState
              icon={SearchX}
              title="Kit não encontrado"
              description="Este kit não existe ou não está mais à venda."
              action={<ButtonLink href="/pacotes">Ver kits disponíveis</ButtonLink>}
            />
          ) : (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          )}
        </Card>
      </main>
    )
  }

  const pkg = query.data
  const totalSize = pkg.files.reduce((s, f) => s + f.size, 0)

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 pb-28 md:pb-10">
      {back}
      <div className="mt-6 grid gap-8 md:grid-cols-2 md:items-start">
        <div className="overflow-hidden rounded-3xl shadow-sm bg-white md:sticky md:top-24">
          <PackageCover src={pkg.coverUrl} alt={pkg.title} className="aspect-[4/3] w-full" />
        </div>

        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-brand-cocoa">{pkg.title}</h1>
          <p className="mt-3 text-gray-700 text-[17px] leading-relaxed">{pkg.description}</p>

          <div className="mt-6 flex items-end gap-4">
            <p className="text-3xl font-bold text-gray-900 tabular-nums">{formatBRL(pkg.priceCents)}</p>
            <p className="pb-1 text-sm text-gray-500">pagamento único</p>
          </div>

          <ul className="mt-4 grid gap-2 text-sm text-gray-700">
            <li className="flex items-center gap-2">
              <Zap size={16} className="text-brand-teal" /> Liberação imediata após o pagamento
            </li>
            <li className="flex items-center gap-2">
              <CreditCard size={16} className="text-brand-teal" /> Pix ou cartão de crédito
            </li>
            <li className="flex items-center gap-2">
              <CalendarClock size={16} className="text-brand-teal" /> {accessLabel(pkg.accessDays)} para baixar
            </li>
          </ul>

          <ButtonLink href={`/checkout/${pkg.slug}`} size="lg" className="mt-6 w-full sm:w-auto hidden md:inline-flex">
            Comprar agora
          </ButtonLink>

          <Card className="mt-8 p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold text-gray-900">O que vem no kit</h2>
              <p className="text-xs text-gray-500">
                {pkg.files.length} arquivos · {formatBytes(totalSize)}
              </p>
            </div>
            <ul className="mt-4 divide-y divide-black/5">
              {pkg.files.map((f) => (
                <li key={f.filename} className="flex items-center gap-3 py-2.5">
                  <FileIcon mime={f.mime} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{f.filename}</p>
                    <p className="text-xs text-gray-500">
                      {fileKind(f.mime).label} · {formatBytes(f.size)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <div className="mt-8 space-y-2">
            <h2 className="font-semibold text-gray-900 mb-3">Dúvidas frequentes</h2>
            {faq.map(({ q, a }) => (
              <details key={q} className="group rounded-2xl bg-white/70 border border-black/5 px-4 py-3">
                <summary className="cursor-pointer list-none flex justify-between items-center text-sm font-medium text-gray-800">
                  {q}
                  <span className="text-gray-400 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
                </summary>
                <p className="mt-2 text-sm text-gray-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* Barra fixa de compra no celular */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 backdrop-blur px-4 py-3 flex items-center gap-4">
        <div>
          <p className="text-xs text-gray-500">{pkg.title}</p>
          <p className="text-lg font-bold tabular-nums">{formatBRL(pkg.priceCents)}</p>
        </div>
        <ButtonLink href={`/checkout/${pkg.slug}`} className="flex-1">
          Comprar agora
        </ButtonLink>
      </div>
    </main>
  )
}

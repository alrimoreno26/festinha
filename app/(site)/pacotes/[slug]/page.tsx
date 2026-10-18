'use client'

import { PackageCover } from '@/components/catalog/PackageCard'
import { ButtonLink, Card, EmptyState, ErrorState, FileIcon, fileKind, KindBadge, Skeleton } from '@/components/ui'
import { accessLabel, formatBRL, formatBytes, unitsLabel } from '@/lib/format'
import { packagesService, qk, ServiceError } from '@/lib/services'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/cn'
import { isBusiness } from '@/lib/contracts'
import { useState } from 'react'
import type { PackageKind } from '@/lib/types'
import { BRAND, whatsappUrl } from '@/lib/brand'
import { CalendarClock, ChevronLeft, CreditCard, Mail, MessageCircle, Palette, SearchX, Store, Truck, Zap, type LucideIcon } from 'lucide-react'
import Link from 'next/link'

const pixFaq = { q: 'O pagamento por Pix demora?', a: 'Normalmente é confirmado em segundos. A página atualiza sozinha quando o Pix cair.' }

const FAQ: Record<PackageKind, { q: string; a: string }[]> = {
  digital: [
    { q: 'Como recebo os arquivos?', a: 'Assim que o pagamento é confirmado, enviamos por email seus dados de acesso à Área do Cliente, onde você baixa tudo.' },
    { q: 'Preciso de impressora especial?', a: 'Não. Os arquivos funcionam em impressoras caseiras. Para melhor acabamento, use papel fotográfico ou de gramatura 180g ou mais.' },
    pixFaq,
  ],
  custom_digital: [
    { q: 'Como envio os dados da personalização?', a: 'No checkout você informa o nome, a idade, o tema, as cores e o que mais quiser. Para completar algum detalhe, você tem até 48 horas pelo WhatsApp.' },
    { q: 'Quando recebo a arte?', a: 'O prazo é combinado conforme o modelo. Quando a arte fica pronta, avisamos por email e os arquivos aparecem na sua Área do Cliente, em Pedidos.' },
    { q: 'Posso pedir alterações?', a: 'Sim: as alterações na arte podem ser pedidas em até 48 horas após a aprovação. Depois desse prazo não é possível fazer novas mudanças.' },
  ],
  printed: [
    { q: 'Como recebo o kit impresso?', a: 'Você pode retirar no local, em horário combinado, ou receber em casa pelos Correios ou transportadora. O frete e o prazo são calculados no checkout pelo seu CEP, e você recebe o código de rastreio por email quando o pedido for enviado.' },
    { q: 'Como envio os dados da personalização?', a: 'No checkout você informa o nome, a idade, o tema, as cores e o que mais quiser. Para completar algum detalhe, você tem até 48 horas pelo WhatsApp.' },
    { q: 'Qual é o prazo?', a: 'O prazo de produção é combinado conforme o modelo e a personalização escolhidos.' },
  ],
}

/** Papelaria para empresas (cartões de garantia, de cuidados, tags…): dúvidas próprias. */
const BUSINESS_FAQ = [
  { q: 'Como envio o meu logo?', a: 'No checkout você envia o logo (PNG, JPG, SVG ou PDF) e conta os textos e as cores. Se preferir, mande depois pelo WhatsApp.' },
  { q: 'Vou ver a arte antes de imprimir?', a: 'Sim. Montamos a arte com a identidade da sua marca e enviamos para você aprovar antes da impressão. Alterações podem ser pedidas em até 48 horas após a aprovação.' },
  { q: 'Como recebo os cartões?', a: 'Você pode retirar no local ou receber em casa pelos Correios ou transportadora, com frete calculado pelo CEP no checkout.' },
  pixFaq,
]

const FEATURES: Record<PackageKind, (accessDays: number | null) => { icon: LucideIcon; text: string }[]> = {
  digital: (days) => [
    { icon: Zap, text: 'Liberação imediata após o pagamento' },
    { icon: CreditCard, text: 'Pix ou cartão de crédito' },
    { icon: CalendarClock, text: `${accessLabel(days)} para baixar` },
  ],
  custom_digital: () => [
    { icon: Palette, text: 'Personalizado com nome, idade, tema e cores' },
    { icon: Mail, text: 'Arte enviada na sua Área do Cliente quando ficar pronta' },
    { icon: CreditCard, text: 'Pix ou cartão de crédito' },
  ],
  printed: () => [
    { icon: Palette, text: 'Personalizado com nome, idade, tema e cores' },
    { icon: Store, text: `Retirada no local (${BRAND.city})` },
    { icon: Truck, text: 'Ou envio para todo o Brasil, com frete calculado pelo CEP' },
  ],
}

export default function PacotePage({ params }: { params: { slug: string } }) {
  const [variantId, setVariantId] = useState<string | null>(null)
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
          <Skeleton className="aspect-square rounded-3xl" />
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
  const units = pkg.items.reduce((s, i) => s + i.quantity, 0)
  const faq = isBusiness(pkg) ? BUSINESS_FAQ : FAQ[pkg.kind]
  const option = pkg.variants.find((v) => v.id === variantId) ?? pkg.variants[0] ?? null
  const price = option?.priceCents ?? pkg.priceCents
  const buyHref = `/checkout/${pkg.slug}${option ? `?opcao=${option.id}` : ''}`

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 pb-28 md:pb-10">
      {back}
      <div className="mt-6 grid gap-8 md:grid-cols-2 md:items-start">
        <div className="overflow-hidden rounded-3xl shadow-sm bg-white md:sticky md:top-24">
          <PackageCover src={pkg.coverUrl} alt={pkg.title} className="aspect-square w-full" />
        </div>

        <div>
          <KindBadge kind={pkg.kind} />
          <h1 className="mt-2 text-3xl md:text-4xl font-bold text-brand-ink">{pkg.title}</h1>
          <p className="mt-3 text-gray-700 text-[17px] leading-relaxed">{pkg.description}</p>

          <div className="mt-6 flex items-end gap-4">
            <p className="text-3xl font-bold text-gray-900 tabular-nums">{formatBRL(price)}</p>
            <p className="pb-1 text-sm text-gray-500">{option ? option.label : 'pagamento único'}</p>
          </div>

          <ul className="mt-4 grid gap-2 text-sm text-gray-700">
            {FEATURES[pkg.kind](pkg.accessDays).map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2">
                <Icon size={16} className="text-brand-grape shrink-0" /> {text}
              </li>
            ))}
          </ul>

          {pkg.variants.length > 0 && (
            <div className="mt-5" role="radiogroup" aria-label="Quantidade">
              <p className="mb-2 text-sm font-semibold text-gray-700">Quantidade</p>
              <div className="flex flex-wrap gap-2">
                {pkg.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={option?.id === v.id}
                    onClick={() => setVariantId(v.id)}
                    className={cn(
                      'rounded-2xl border-2 px-4 py-2 text-left text-sm transition-colors',
                      option?.id === v.id ? 'border-brand-rose bg-brand-blush' : 'border-gray-200 bg-white hover:border-brand-pink',
                    )}
                  >
                    <span className="block font-semibold text-gray-900">{v.label}</span>
                    <span className="block tabular-nums text-brand-rose">{formatBRL(v.priceCents)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <ButtonLink href={buyHref} size="lg" className="mt-6 w-full sm:w-auto hidden md:inline-flex">
            Comprar agora
          </ButtonLink>

          {pkg.items.length > 0 && (
            <Card className="mt-8 p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold text-gray-900">O que vem no kit</h2>
                <p className="text-xs text-gray-500">{unitsLabel(units)}</p>
              </div>
              <ul className="mt-4 space-y-2">
                {pkg.items.map((i) => (
                  <li key={i.name} className="flex items-center gap-3 text-sm">
                    <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-brand-blush px-2 font-display font-bold text-brand-rose">
                      {i.quantity}
                    </span>
                    <span className="text-gray-800">{i.name}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {pkg.kind !== 'digital' && (
            <a
              href={whatsappUrl(`Olá! Tenho uma dúvida sobre o ${pkg.title}.`)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-grape hover:underline"
            >
              <MessageCircle size={16} /> Dúvidas sobre prazo ou tema? Fale com a gente
            </a>
          )}

          {pkg.kind === 'digital' && pkg.files.length > 0 && (
          <Card className="mt-8 p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold text-gray-900">{pkg.items.length ? 'Arquivos' : 'O que vem no kit'}</h2>
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
          )}

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
          <p className="text-lg font-bold tabular-nums">{formatBRL(price)}</p>
        </div>
        <ButtonLink href={buyHref} className="flex-1">
          Comprar agora
        </ButtonLink>
      </div>
    </main>
  )
}

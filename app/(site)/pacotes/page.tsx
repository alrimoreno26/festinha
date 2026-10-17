'use client'

import { PackageCard, PackageCardSkeleton } from '@/components/catalog/PackageCard'
import { Card, EmptyState, PACKAGE_KIND, QueryState } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { PackageKind } from '@/lib/types'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { packagesService, qk } from '@/lib/services'
import { useQuery } from '@tanstack/react-query'
import { Gift, PackageOpen, Palette, PartyPopper, ShoppingBag } from 'lucide-react'

const steps = [
  { icon: ShoppingBag, title: 'Escolha o kit', desc: 'Digital pronto, personalizado ou impresso.' },
  { icon: Palette, title: 'Conte os detalhes', desc: 'Tema, nome e idade nos personalizados.' },
  { icon: Gift, title: 'Receba', desc: 'Download na hora, arte na Área do Cliente ou impresso pronto.' },
  { icon: PartyPopper, title: 'Monte e celebre', desc: 'Recorte, monte e deixe a festa linda.' },
]

const stepBg = ['bg-brand-pink/40', 'bg-brand-sun/50', 'bg-brand-mint/60', 'bg-brand-lilac/60']

const TABS: { value: PackageKind | null; label: string }[] = [
  { value: null, label: 'Todos' },
  { value: 'digital', label: 'Digitais prontos' },
  { value: 'custom_digital', label: 'Personalizados' },
  { value: 'printed', label: 'Impressos' },
]

export default function PacotesPage() {
  return (
    <Suspense>
      <Pacotes />
    </Suspense>
  )
}

function Pacotes() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const raw = params.get('tipo')
  const kind = raw && raw in PACKAGE_KIND ? (raw as PackageKind) : null
  const query = useQuery({ queryKey: qk.publicPackages, queryFn: packagesService.listPublic })
  // Abas só para os tipos que existem no catálogo (sem abas vazias).
  const kinds = new Set(query.data?.map((p) => p.kind))
  const tabs = TABS.filter((t) => t.value === null || kinds.has(t.value))

  return (
    <main className="max-w-6xl mx-auto px-4 py-12 md:py-16">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h1 className="text-4xl md:text-6xl font-bold text-brand-ink">
          Nossos <span className="text-rainbow">kits</span>
        </h1>
        <p className="mt-4 text-[17px]">
          Arquivos digitais para imprimir em casa, artes personalizadas com o nome da criança e kits impressos prontos para a sua festa. Pague com Pix ou cartão.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-12">
        {steps.map(({ icon: Icon, title, desc }, i) => (
          <div key={title} className={`rounded-3xl p-4 ${stepBg[i]}`}>
            <div className="flex items-center gap-2 text-brand-ink">
              <Icon size={18} />
              <span className="text-xs font-semibold">Passo {i + 1}</span>
            </div>
            <p className="mt-2 font-display font-semibold text-brand-ink">{title}</p>
            <p className="text-xs mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {tabs.length > 2 && (
        <div className="mb-6 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Tipo de kit">
          {tabs.map((t) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={kind === t.value}
              onClick={() => router.replace(t.value ? `${pathname}?tipo=${t.value}` : pathname, { scroll: false })}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                kind === t.value ? 'bg-brand-rose text-white shadow-sm' : 'bg-white text-brand-ink ring-1 ring-brand-pink/40 hover:bg-brand-blush',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <QueryState
        query={query}
        loading={
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }, (_, i) => (
              <PackageCardSkeleton key={i} />
            ))}
          </div>
        }
        empty={
          <Card>
            <EmptyState
              icon={PackageOpen}
              title="Nenhum kit disponível no momento"
              description="Estamos preparando novidades! Fale com a gente pelo WhatsApp."
            />
          </Card>
        }
      >
        {(packages) => (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.filter((pkg) => !kind || pkg.kind === kind).map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        )}
      </QueryState>
    </main>
  )
}

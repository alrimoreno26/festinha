'use client'

import { PackageCard, PackageCardSkeleton } from '@/components/catalog/PackageCard'
import { Card, EmptyState, QueryState } from '@/components/ui'
import { packagesService, qk } from '@/lib/services'
import { useQuery } from '@tanstack/react-query'
import { Download, Mail, PackageOpen, Printer, ShoppingBag } from 'lucide-react'

const steps = [
  { icon: ShoppingBag, title: 'Escolha e pague', desc: 'Pix ou cartão, com liberação imediata.' },
  { icon: Mail, title: 'Receba o acesso', desc: 'Enviamos seus dados de login por email.' },
  { icon: Download, title: 'Baixe os arquivos', desc: 'Tudo fica na sua Área do Cliente.' },
  { icon: Printer, title: 'Imprima e monte', desc: 'Recorte, cole e deixe a festa linda.' },
]

export default function PacotesPage() {
  const query = useQuery({ queryKey: qk.publicPackages, queryFn: packagesService.listPublic })

  return (
    <main className="max-w-6xl mx-auto px-4 py-12 md:py-16">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h1 className="text-3xl md:text-5xl font-extrabold text-brand-cocoa">
          Kits digitais <span className="text-brand-coral">pega e monta</span>
        </h1>
        <p className="mt-4 text-gray-600 text-[17px]">
          Arquivos prontos para imprimir em casa ou na gráfica. Escolha o tema, baixe na hora e monte sua festa.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-12">
        {steps.map(({ icon: Icon, title, desc }, i) => (
          <div key={title} className="rounded-3xl bg-white/70 border border-black/5 p-4">
            <div className="flex items-center gap-2 text-brand-teal">
              <Icon size={18} />
              <span className="text-xs font-semibold">Passo {i + 1}</span>
            </div>
            <p className="mt-2 font-semibold text-gray-900 text-sm">{title}</p>
            <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

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
              description="Estamos preparando novidades! Fale com a gente pelo WhatsApp para um kit personalizado."
            />
          </Card>
        }
      >
        {(packages) => (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        )}
      </QueryState>
    </main>
  )
}

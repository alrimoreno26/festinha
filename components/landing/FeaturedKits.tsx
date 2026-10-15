'use client'

import { SectionTitle } from '@/components/brand/Decor'
import { PackageCard, PackageCardSkeleton } from '@/components/catalog/PackageCard'
import { ButtonLink } from '@/components/ui'
import { packagesService, qk } from '@/lib/services'
import { useQuery } from '@tanstack/react-query'

/** Vitrine de kits na landing. Se não houver kits (ou der erro), a seção simplesmente não aparece. */
export function FeaturedKits() {
  const query = useQuery({ queryKey: qk.publicPackages, queryFn: packagesService.listPublic })
  if (query.isError || (query.isSuccess && query.data.length === 0)) return null

  return (
    <section id="kits" className="py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4">
        <SectionTitle subtitle="Compre, baixe na hora, imprima em casa e monte sua festa.">Kits pega e monta</SectionTitle>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {query.isPending
            ? Array.from({ length: 3 }, (_, i) => <PackageCardSkeleton key={i} />)
            : query.data.slice(0, 3).map((pkg) => <PackageCard key={pkg.id} pkg={pkg} />)}
        </div>
        <div className="mt-10 text-center">
          <ButtonLink href="/pacotes" variant="outline">
            Ver todos os kits
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}

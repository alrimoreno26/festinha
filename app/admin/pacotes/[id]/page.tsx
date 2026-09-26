'use client'

import { PackageForm } from '@/components/admin/PackageForm'
import { Badge, PageHeader, QueryState } from '@/components/ui'
import { packagesService, qk } from '@/lib/services'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function EditarPacotePage({ params }: { params: { id: string } }) {
  // O formulário guarda o próprio estado (key = id), então refetches não apagam o que está sendo editado.
  const query = useQuery({ queryKey: qk.adminPackage(params.id), queryFn: () => packagesService.get(params.id) })

  return (
    <QueryState query={query}>
      {(pkg) => (
        <>
          <PageHeader
            title={
              <span className="flex items-center gap-3">
                {pkg.title} <Badge tone={pkg.active ? 'success' : 'neutral'}>{pkg.active ? 'No catálogo' : 'Oculto'}</Badge>
              </span>
            }
            back={
              <Link href="/admin/pacotes" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                <ChevronLeft size={16} /> Pacotes
              </Link>
            }
          />
          <PackageForm key={pkg.id} pkg={pkg} />
        </>
      )}
    </QueryState>
  )
}

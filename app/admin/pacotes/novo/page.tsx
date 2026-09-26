'use client'

import { PackageForm } from '@/components/admin/PackageForm'
import { PageHeader } from '@/components/ui'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function NovoPacotePage() {
  return (
    <>
      <PageHeader
        title="Novo pacote"
        back={
          <Link href="/admin/pacotes" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
            <ChevronLeft size={16} /> Pacotes
          </Link>
        }
      />
      <PackageForm />
    </>
  )
}

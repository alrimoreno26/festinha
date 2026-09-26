'use client'

import { PackageCover } from '@/components/catalog/PackageCard'
import { ButtonLink, Card, EmptyState, EntitlementBadge, PageHeader, QueryState, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { canDownload, expiryText } from '@/lib/entitlements'
import { useSession } from '@/lib/hooks/useSession'
import { accountService, qk } from '@/lib/services'
import type { MyKit } from '@/lib/services/account'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Files, PackageOpen } from 'lucide-react'
import Link from 'next/link'

function KitCard({ kit }: { kit: MyKit }) {
  const available = canDownload(kit.status)
  return (
    <Link href={`/conta/kits/${kit.package.id}`} className="group block focus-visible:outline-none">
      <Card className={cn('overflow-hidden h-full flex flex-col transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-brand-teal')}>
        <div className="relative">
          <PackageCover src={kit.package.coverUrl} alt={kit.package.title} className={cn('h-40 w-full', !available && 'grayscale opacity-60')} />
          <div className="absolute top-3 left-3">
            <EntitlementBadge status={kit.status} />
          </div>
        </div>
        <div className="p-5 flex flex-col flex-1">
          <h3 className="font-semibold text-gray-900">{kit.package.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
            <Files size={14} /> {kit.fileCount} arquivos
          </p>
          <p className={cn('mt-2 text-sm', kit.status === 'expiring' ? 'text-amber-700 font-medium' : 'text-gray-600')}>
            {expiryText(kit.entitlement)}
          </p>
          <span className={cn('mt-auto pt-4 text-sm font-medium', available ? 'text-brand-coral' : 'text-gray-500')}>
            {available ? 'Abrir e baixar →' : 'Ver detalhes →'}
          </span>
        </div>
      </Card>
    </Link>
  )
}

export default function MeusKitsPage() {
  const { user } = useSession()
  const query = useQuery({ queryKey: qk.myKits, queryFn: accountService.myKits })
  const expiring = query.data?.filter((k) => k.status === 'expiring') ?? []

  return (
    <>
      <PageHeader title={`Olá, ${user?.name.split(' ')[0] ?? ''}!`} description="Aqui estão os kits que você comprou. Baixe, imprima e monte 🎉" />

      {expiring.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <p>
            {expiring.length === 1 ? (
              <>
                O acesso ao <strong>{expiring[0].package.title}</strong> vence em breve.
              </>
            ) : (
              <>{expiring.length} kits vencem em breve.</>
            )}{' '}
            Baixe os arquivos e guarde no seu computador.
          </p>
        </div>
      )}

      <QueryState
        query={query}
        loading={
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-40 rounded-none" />
                <div className="p-5 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </Card>
            ))}
          </div>
        }
        empty={
          <Card>
            <EmptyState
              icon={PackageOpen}
              title="Você ainda não tem kits"
              description="Quando você comprar um kit, ele aparece aqui para baixar."
              action={<ButtonLink href="/pacotes">Ver kits disponíveis</ButtonLink>}
            />
          </Card>
        }
      >
        {(kits) => (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {kits.map((kit) => (
              <KitCard key={kit.entitlement.id} kit={kit} />
            ))}
          </div>
        )}
      </QueryState>
    </>
  )
}

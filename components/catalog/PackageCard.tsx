import { Card, Skeleton } from '@/components/ui'
import { accessLabel, formatBRL } from '@/lib/format'
import type { PublicPackage } from '@/lib/services/packages'
import { Files, ImageOff } from 'lucide-react'
import Link from 'next/link'

export function PackageCover({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src)
    return (
      <div className={`flex items-center justify-center bg-brand-blush text-brand-coral/60 ${className ?? ''}`}>
        <ImageOff size={32} />
      </div>
    )
  return <img src={src} alt={alt} className={`object-cover ${className ?? ''}`} />
}

export function PackageCard({ pkg }: { pkg: PublicPackage }) {
  return (
    <Link href={`/pacotes/${pkg.slug}`} className="group block focus-visible:outline-none">
      <Card className="overflow-hidden h-full flex flex-col transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-brand-teal">
        <div className="overflow-hidden">
          <PackageCover src={pkg.coverUrl} alt={pkg.title} className="h-48 w-full transition-transform duration-300 group-hover:scale-105" />
        </div>
        <div className="p-5 flex flex-col flex-1">
          <h3 className="font-semibold text-lg text-brand-cocoa">{pkg.title}</h3>
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">{pkg.description}</p>
          <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Files size={14} /> {pkg.files.length} arquivos
            </span>
            <span>·</span>
            <span>{accessLabel(pkg.accessDays)}</span>
          </div>
          <div className="mt-auto pt-4 flex items-center justify-between">
            <p className="text-xl font-bold text-gray-900 tabular-nums">{formatBRL(pkg.priceCents)}</p>
            <span className="text-sm font-medium text-brand-coral group-hover:underline">Ver kit →</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}

export function PackageCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-48 rounded-none" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-7 w-24 mt-4" />
      </div>
    </Card>
  )
}

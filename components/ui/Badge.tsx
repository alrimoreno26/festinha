import { cn } from '@/lib/cn'
import { DELIVERY_LABEL, KIND_LABEL } from '@/lib/labels'
import type { DeliveryMethod, EntitlementStatus, OrderStatus, PackageKind, PaymentMethod, ProductionStatus } from '@/lib/types'
import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  danger: 'bg-red-50 text-red-700 ring-red-600/15',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/15',
  brand: 'bg-brand-blush text-brand-rose-dark ring-brand-rose/20',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-black/5 whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  )
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pendente', tone: 'warning' },
  approved: { label: 'Aprovado', tone: 'success' },
  rejected: { label: 'Recusado', tone: 'danger' },
  refunded: { label: 'Reembolsado', tone: 'neutral' },
  charged_back: { label: 'Chargeback', tone: 'danger' },
}

export const ENTITLEMENT_STATUS: Record<EntitlementStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Ativo', tone: 'success' },
  expiring: { label: 'Vence em breve', tone: 'warning' },
  expired: { label: 'Vencido', tone: 'neutral' },
  revoked: { label: 'Revogado', tone: 'danger' },
}

export const PAYMENT_METHOD: Record<PaymentMethod, string> = { pix: 'Pix', card: 'Cartão' }

export const PACKAGE_KIND: Record<PackageKind, { label: string; short: string; tone: BadgeTone }> = {
  digital: { label: KIND_LABEL.digital, short: 'Digital', tone: 'info' },
  custom_digital: { label: KIND_LABEL.custom_digital, short: 'Personalizado', tone: 'brand' },
  printed: { label: KIND_LABEL.printed, short: 'Impresso', tone: 'warning' },
}

export const PRODUCTION_STATUS: Record<ProductionStatus, { label: string; tone: BadgeTone }> = {
  in_production: { label: 'Em produção', tone: 'warning' },
  ready: { label: 'Pronto', tone: 'info' },
  delivered: { label: 'Entregue', tone: 'success' },
}

export const DELIVERY_METHOD: Record<DeliveryMethod, string> = DELIVERY_LABEL

export function KindBadge({ kind }: { kind: PackageKind }) {
  const { short, tone } = PACKAGE_KIND[kind]
  return <Badge tone={tone}>{short}</Badge>
}

export function ProductionBadge({ status }: { status: ProductionStatus }) {
  const { label, tone } = PRODUCTION_STATUS[status]
  return <Badge tone={tone}>{label}</Badge>
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, tone } = ORDER_STATUS[status]
  return <Badge tone={tone}>{label}</Badge>
}

export function EntitlementBadge({ status }: { status: EntitlementStatus }) {
  const { label, tone } = ENTITLEMENT_STATUS[status]
  return <Badge tone={tone}>{label}</Badge>
}

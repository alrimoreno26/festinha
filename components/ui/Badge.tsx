import { cn } from '@/lib/cn'
import type { EntitlementStatus, OrderStatus, PaymentMethod } from '@/lib/types'
import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  danger: 'bg-red-50 text-red-700 ring-red-600/15',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/15',
  brand: 'bg-brand-blush text-brand-coral-dark ring-brand-coral/20',
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

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, tone } = ORDER_STATUS[status]
  return <Badge tone={tone}>{label}</Badge>
}

export function EntitlementBadge({ status }: { status: EntitlementStatus }) {
  const { label, tone } = ENTITLEMENT_STATUS[status]
  return <Badge tone={tone}>{label}</Badge>
}

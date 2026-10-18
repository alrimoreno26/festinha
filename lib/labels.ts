// Rótulos em português usados na interface, nos emails e nos avisos do Telegram.
import type { DeliveryMethod, PackageKind } from './types'

export const KIND_LABEL: Record<PackageKind, string> = {
  digital: 'Kit digital pronto',
  custom_digital: 'Personalizado digital',
  printed: 'Kit impresso',
}

export const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  download: 'Download na Área do Cliente',
  pickup: 'Retirada no local',
  shipping: 'Envio pelos Correios/transportadora',
}

/** Opção escolhida com as folhas A4, ex.: "100 cartões · 12 folhas A4" (útil para a produção). */
export function variantText(v: { label: string; sheets?: number }) {
  return v.sheets && !/folha/i.test(v.label) ? `${v.label} · ${v.sheets} ${v.sheets === 1 ? 'folha' : 'folhas'} A4` : v.label
}

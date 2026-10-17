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
  delivery: 'Entrega (motoboy/aplicativo)',
}

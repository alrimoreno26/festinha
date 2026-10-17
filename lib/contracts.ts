// Contratos compartilhados entre cliente (lib/services) e servidor (lib/server):
// formatos de resposta da API e esquemas de validação de entrada.

import { z } from 'zod'
import type {
  CustomizationLevel,
  DeliveryMethod,
  Entitlement,
  EntitlementStatus,
  FileItem,
  Order,
  OrderStatus,
  Package,
  PackageKind,
  PaymentMethod,
  ProductionStatus,
  ShippingChoice,
  User,
} from './types'

// ---------------------------------------------------------------------------
// Pacotes
// ---------------------------------------------------------------------------

export type PackageInput = Pick<
  Package,
  'title' | 'slug' | 'description' | 'coverUrl' | 'priceCents' | 'active' | 'accessDays' | 'fileIds' | 'kind' | 'items' | 'customizationLevel' | 'shippingBox'
>

export const needsCustomization = (pkg: Pick<Package, 'customizationLevel'>) => pkg.customizationLevel !== 'none'
/** Só a personalização completa leva nome e idade na arte. */
export const needsName = (pkg: Pick<Package, 'customizationLevel'>) => pkg.customizationLevel === 'full'

/** Nível efetivo para o tipo: kit pronto não pede nada, impresso pede tudo, personalizado digital escolhe. */
export function customizationFor(kind: PackageKind, level: CustomizationLevel): CustomizationLevel {
  if (kind === 'digital') return 'none'
  if (kind === 'printed') return 'full'
  return level === 'theme' ? 'theme' : 'full'
}

/** O que o catálogo público vê de cada arquivo: só nome, tipo e tamanho (nunca a key do bucket). */
export type PublicFile = Pick<FileItem, 'filename' | 'mime' | 'size'>

export interface PublicPackage extends Omit<Package, 'fileIds' | 'active'> {
  /** Impresso com envio disponível (medidas cadastradas e frete configurado). */
  shippable: boolean
  files: PublicFile[]
}

export interface AdminPackageRow extends Package {
  salesCount: number
  revenueCents: number
}

// ---------------------------------------------------------------------------
// Arquivos
// ---------------------------------------------------------------------------

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024

export interface FolderListing {
  path: string
  folders: { path: string; name: string; fileCount: number }[]
  files: (FileItem & { usedIn: Pick<Package, 'id' | 'title'>[] })[]
  /** Onde os arquivos estão: R2 de verdade ou modo de demonstração (sem credenciais). */
  storage: { kind: 'r2' | 'demo'; bucket: string | null }
}

export interface UploadTicket {
  key: string
  /** URL assinada para PUT direto no bucket; null no modo demonstração. */
  uploadUrl: string | null
  headers: Record<string, string>
}

export interface SyncResult {
  /** Arquivos do bucket que foram registrados agora. */
  added: number
  /** Pastas (marcadores) do bucket que foram registradas agora. */
  addedFolders: number
  alreadyRegistered: number
  /** Registros cujo arquivo não existe no bucket (depois da limpeza, se `prune`). */
  missingInBucket: number
  /** Pacotes que contêm arquivos ausentes do bucket. */
  affectedPackages: number
  /** Só com `prune`: registros removidos, pastas removidas e pacotes ocultados por ficarem sem arquivos. */
  removed: number
  removedFolders: number
  deactivatedPackages: string[]
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export const customizationSchema = z.object({
  childName: z.string().trim().max(120).default(''),
  age: z.string().trim().max(40).default(''),
  theme: z.string().trim().max(200).default(''),
  colors: z.string().trim().max(200).default(''),
  notes: z.string().trim().max(2000).default(''),
})

export const shippingAddressSchema = z.object({
  postalCode: z.string().trim().max(9).default(''),
  street: z.string().trim().max(200).default(''),
  number: z.string().trim().max(20).default(''),
  complement: z.string().trim().max(100).default(''),
  district: z.string().trim().max(100).default(''),
  city: z.string().trim().max(100).default(''),
  state: z.string().trim().max(2).default(''),
})

export interface ShippingQuote {
  options: ShippingChoice[]
}

export const checkoutSchema = z.object({
  packageSlug: z.string().min(1),
  customization: customizationSchema.optional(),
  deliveryMethod: z.enum(['download', 'pickup', 'shipping']).optional(),
  shippingAddress: shippingAddressSchema.optional(),
  /** Serviço escolhido entre as opções da cotação; o preço é recalculado no servidor. */
  shippingServiceId: z.number().int().optional(),
  name: z.string().trim().min(3, 'Informe seu nome completo.'),
  email: z.string().trim().toLowerCase().email('Informe um email válido.'),
  phone: z
    .string()
    .trim()
    .refine((v) => v.replace(/\D/g, '').length >= 10, 'Informe um WhatsApp com DDD.'),
})

export type CheckoutInput = z.input<typeof checkoutSchema>

export interface PublicOrder {
  id: string
  status: OrderStatus
  method: PaymentMethod
  amountCents: number
  email: string
  packageTitle: string
  packageSlug: string
  packageKind: PackageKind
  deliveryMethod: DeliveryMethod
  productionStatus: ProductionStatus | null
  createdAt: string
  /** Se o email já tinha conta antes desta compra. */
  existingAccount: boolean
  /** Só no simulador: QR/código fictício. No Mercado Pago o Pix é exibido na página do MP. */
  pix: { copyPaste: string; expiresAt: string } | null
  provider: 'mercadopago' | 'simulator'
  /** Pagamento pendente no MP: link para o cliente voltar à página de pagamento. */
  resumeUrl: string | null
}

// ---------------------------------------------------------------------------
// Pedidos (admin)
// ---------------------------------------------------------------------------

export interface OrderFilters {
  status?: OrderStatus | 'all'
  search?: string
  /** Últimos N dias. */
  days?: number
  /** Só pedidos sob encomenda pagos que ainda não foram entregues. */
  toProduce?: boolean
}

export interface AdminOrderRow extends Order {
  packageTitle: string
  packageKind: PackageKind
}

export const productionUpdateSchema = z.object({
  status: z.enum(['in_production', 'ready', 'delivered']),
  /** Código de rastreio, ao marcar um pedido enviado como "despachado". */
  trackingCode: z.string().trim().max(60).optional(),
  /** Arquivos finais (personalizado digital), já enviados ao bucket. */
  fileIds: z.array(z.string()).max(50).optional(),
})

export interface AdminOrderDetail {
  order: Order
  package: Package | null
  customer: User | null
  entitlement: (Entitlement & { status: EntitlementStatus }) | null
  /** Arquivos finais enviados para o cliente (personalizado digital). */
  files: FileItem[]
  /** Como o pedido é pago e o que o Mercado Pago informou por último (para suporte). */
  payment: { provider: 'mercadopago' | 'simulator'; mpPaymentId: string | null; mpStatus: string | null }
}

// ---------------------------------------------------------------------------
// Clientes (admin)
// ---------------------------------------------------------------------------

export interface CustomerRow extends User {
  ordersCount: number
  totalSpentCents: number
  activeKits: number
  lastOrderAt: string | null
}

export interface CustomerEntitlement extends Entitlement {
  status: EntitlementStatus
  package: Pick<Package, 'id' | 'title' | 'slug' | 'coverUrl'>
}

export interface CustomerDetail {
  customer: User
  orders: (Order & { packageTitle: string })[]
  entitlements: CustomerEntitlement[]
  downloadsCount: number
}

export const newCustomerSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome.'),
  email: z.string().trim().toLowerCase().email('Email inválido.'),
  phone: z.string().trim().optional(),
})

// ---------------------------------------------------------------------------
// Área do cliente
// ---------------------------------------------------------------------------

export type KitFile = Pick<FileItem, 'id' | 'filename' | 'mime' | 'size'>

export interface MyKit {
  entitlement: Entitlement
  status: EntitlementStatus
  package: Pick<Package, 'id' | 'slug' | 'title' | 'description' | 'coverUrl'>
  fileCount: number
}

export interface MyKitDetail extends MyKit {
  files: KitFile[]
}

export interface MyOrder extends Order {
  packageTitle: string
  packageKind: PackageKind
  /** Arquivos finais do pedido personalizado (vazio até ficar pronto). */
  files: KitFile[]
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardStats {
  periodDays: number
  revenueCents: number
  previousRevenueCents: number
  paidOrders: number
  pendingOrders: number
  newCustomers: number
  byStatus: Record<OrderStatus, number>
  /** Receita por dia (mais antigo → mais recente). */
  daily: { date: string; revenueCents: number; orders: number }[]
  topPackages: { id: string; title: string; sales: number; revenueCents: number }[]
}

// ---------------------------------------------------------------------------
// Utilidades de validação
// ---------------------------------------------------------------------------

/** Converte os erros do zod em { campo: mensagem } (formato de `ServiceError.details`). */
export function zodDetails(error: z.ZodError) {
  return Object.fromEntries(error.issues.map((i) => [String(i.path[0]), i.message]))
}

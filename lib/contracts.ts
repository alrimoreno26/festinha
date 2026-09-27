// Contratos compartilhados entre cliente (lib/services) e servidor (lib/server):
// formatos de resposta da API e esquemas de validação de entrada.

import { z } from 'zod'
import type { Entitlement, EntitlementStatus, FileItem, Order, OrderStatus, Package, PaymentMethod, User } from './types'

// ---------------------------------------------------------------------------
// Pacotes
// ---------------------------------------------------------------------------

export type PackageInput = Pick<Package, 'title' | 'slug' | 'description' | 'coverUrl' | 'priceCents' | 'active' | 'accessDays' | 'fileIds'>

/** O que o catálogo público vê de cada arquivo: só nome, tipo e tamanho (nunca a key do bucket). */
export type PublicFile = Pick<FileItem, 'filename' | 'mime' | 'size'>

export interface PublicPackage extends Omit<Package, 'fileIds' | 'active'> {
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

export const checkoutSchema = z.object({
  packageSlug: z.string().min(1),
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
  createdAt: string
  /** Se o email já tinha conta antes desta compra. */
  existingAccount: boolean
  pix: { copyPaste: string; expiresAt: string } | null
}

// ---------------------------------------------------------------------------
// Pedidos (admin)
// ---------------------------------------------------------------------------

export interface OrderFilters {
  status?: OrderStatus | 'all'
  search?: string
  /** Últimos N dias. */
  days?: number
}

export interface AdminOrderRow extends Order {
  packageTitle: string
}

export interface AdminOrderDetail {
  order: Order
  package: Package | null
  customer: User | null
  entitlement: (Entitlement & { status: EntitlementStatus }) | null
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

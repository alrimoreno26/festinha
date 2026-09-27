// Tipos de domínio compartilhados entre UI, serviços e (futuramente) a API.

export type ID = string
export type ISODate = string

export type Role = 'admin' | 'customer'

export interface User {
  id: ID
  email: string
  name: string
  phone: string | null
  role: Role
  mustChangePassword: boolean
  createdAt: ISODate
}

/** Arquivo guardado no bucket (R2). `key` é o caminho completo, ex.: `kits/safari/topo-de-bolo.pdf`. */
export interface FileItem {
  id: ID
  key: string
  filename: string
  size: number
  mime: string
  createdAt: ISODate
}

export interface Package {
  id: ID
  slug: string
  title: string
  description: string
  coverUrl: string | null
  priceCents: number
  active: boolean
  /** Dias de acesso após a compra. `null` = vitalício. */
  accessDays: number | null
  /** Arquivos do pacote, na ordem de exibição. */
  fileIds: ID[]
  createdAt: ISODate
  updatedAt: ISODate
}

export type OrderStatus = 'pending' | 'approved' | 'rejected' | 'refunded' | 'charged_back'
export type PaymentMethod = 'pix' | 'card'

export interface Order {
  id: ID
  userId: ID | null
  name: string
  email: string
  phone: string
  packageId: ID
  amountCents: number
  status: OrderStatus
  method: PaymentMethod
  createdAt: ISODate
  paidAt: ISODate | null
}

export interface Entitlement {
  id: ID
  userId: ID
  packageId: ID
  orderId: ID | null
  grantedBy: 'purchase' | 'manual'
  createdAt: ISODate
  expiresAt: ISODate | null
  revokedAt: ISODate | null
}

export type EntitlementStatus = 'active' | 'expiring' | 'expired' | 'revoked'

export interface Download {
  id: ID
  userId: ID
  fileId: ID
  createdAt: ISODate
}

/** Email "enviado" — no mock fica numa caixa de saída visível na DevToolbar. */
export interface OutboxEmail {
  id: ID
  to: string
  subject: string
  body: string
  /** Link de ação opcional (ex.: login, redefinir senha). */
  actionUrl?: string
  actionLabel?: string
  createdAt: ISODate
  /** Quando foi entregue ao provedor de email (null = só registrado / pendente). */
  sentAt?: ISODate | null
  lastError?: string | null
}

export interface Session {
  user: User
}

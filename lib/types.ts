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

/**
 * - digital: arquivos prontos, liberados para download assim que o pagamento é aprovado.
 * - custom_digital: arte personalizada criada depois da compra; o arquivo final é enviado no pedido.
 * - printed: kit impresso, produzido depois da compra e retirado no local ou entregue.
 */
export type PackageKind = 'digital' | 'custom_digital' | 'printed'

/**
 * O que o checkout pede ao cliente:
 * - none: nada (kit digital pronto);
 * - theme: só o tema e observações (ex.: tema individual, com os arquivos do tema escolhido);
 * - full: nome, idade, tema, cores e observações (personalizados e impressos).
 */
export type CustomizationLevel = 'none' | 'theme' | 'full'

/** Item que compõe o pacote, ex.: { name: 'Caixa Milk – 14 cm x 6,5 cm', quantity: 5 }. */
export interface PackageItem {
  name: string
  quantity: number
}

export interface Package {
  id: ID
  slug: string
  title: string
  description: string
  coverUrl: string | null
  priceCents: number
  active: boolean
  kind: PackageKind
  /** O que vem no pacote (quantidades). Opcional para kits digitais prontos. */
  items: PackageItem[]
  /** Detalhes pedidos no checkout. Kit pronto: none; impresso: full; personalizado digital: theme ou full. */
  customizationLevel: CustomizationLevel
  /** Dias de acesso após a compra. `null` = vitalício. */
  accessDays: number | null
  /** Arquivos do pacote, na ordem de exibição. */
  fileIds: ID[]
  createdAt: ISODate
  updatedAt: ISODate
}

/** Detalhes que o cliente informa no checkout para personalizar o pedido. */
export interface Customization {
  childName: string
  age: string
  theme: string
  colors: string
  notes: string
}

export type DeliveryMethod = 'download' | 'pickup' | 'delivery'

/** Andamento dos pedidos feitos sob encomenda (personalizados e impressos). null = kit digital pronto. */
export type ProductionStatus = 'in_production' | 'ready' | 'delivered'

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
  customization: Customization | null
  deliveryMethod: DeliveryMethod
  deliveryAddress: string | null
  productionStatus: ProductionStatus | null
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

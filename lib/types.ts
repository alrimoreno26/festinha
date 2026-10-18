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

/** Linha de produtos: papelaria de festas ou papelaria para empresas (cartões, tags, etiquetas…). */
export type ProductLine = 'festas' | 'empresas'

/** Opção de compra com preço próprio, ex.: "100 unidades" por R$ 59,90. */
export interface PackageVariant {
  id: string
  label: string
  priceCents: number
}

/**
 * O que o checkout pede ao cliente:
 * - none: nada (kit digital pronto);
 * - theme: só o tema e observações (ex.: tema individual, com os arquivos do tema escolhido);
 * - full: nome, idade, tema, cores e observações (personalizados e impressos de festa);
 * - business: nome da marca, textos do cartão, cores, logo e observações (papelaria para empresas).
 */
export type CustomizationLevel = 'none' | 'theme' | 'full' | 'business'

/** Item que compõe o pacote, ex.: { name: 'Caixa Milk – 14 cm x 6,5 cm', quantity: 5 }. */
export interface PackageItem {
  name: string
  quantity: number
}

/** Caixa usada para enviar um pacote impresso (para cotar o frete). */
export interface ShippingBox {
  weightGrams: number
  heightCm: number
  widthCm: number
  lengthCm: number
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
  /** Só impressos: medidas e peso da embalagem. Sem isso, o envio não é oferecido (só retirada). */
  shippingBox: ShippingBox | null
  line: ProductLine
  /** Opções de quantidade/preço. Vazio = preço único (priceCents). Com opções, priceCents é o menor preço. */
  variants: PackageVariant[]
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
  /** Papelaria para empresas: nome da marca/empresa. */
  businessName: string
  /** Papelaria para empresas: o que vai escrito no cartão (Instagram, WhatsApp, frases…). */
  cardText: string
}

/** download: kit digital; pickup: retirada no local; shipping: envio pelos Correios/transportadoras (Melhor Envio). */
export type DeliveryMethod = 'download' | 'pickup' | 'shipping'

export interface ShippingAddress {
  postalCode: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
}

/** Serviço de entrega escolhido no checkout (cotação do Melhor Envio no momento da compra). */
export interface ShippingChoice {
  serviceId: number
  service: string
  company: string
  priceCents: number
  minDays: number
  maxDays: number
}

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
  shippingAddress: ShippingAddress | null
  /** Frete escolhido; o valor já está somado em amountCents. */
  shipping: ShippingChoice | null
  /** Código de rastreio informado pelo admin ao despachar. */
  trackingCode: string | null
  /** Opção escolhida (quando o pacote tem opções de quantidade). */
  variant: PackageVariant | null
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

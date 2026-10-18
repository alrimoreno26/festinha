// Fluxo público de compra.
// Com Mercado Pago: cria o pedido + a preferência (Checkout Pro) e manda o cliente para a página do MP;
// a confirmação chega pelo webhook (e pela consulta na volta para o site).
// Sem Mercado Pago: a página /simulador-mp faz o papel do MP.

import { checkoutSchema, isBusiness, needsCustomization, needsName, priceFor, zodDetails, type CheckoutInput, type PublicOrder } from '@/lib/contracts'
import { ServiceError } from '@/lib/services/errors'
import type { Customization, DeliveryMethod, PackageVariant, PaymentMethod, ShippingAddress, ShippingChoice } from '@/lib/types'
import { and, eq, isNotNull, lte } from 'drizzle-orm'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { newId } from '../ids'
import { getPaymentGateway, type PaymentGateway } from '../payments'
import { approveOrder } from './fulfillment'
import { applyPayment } from './payments'
import { quotePackage } from './shipping'
import { attachUploads } from './uploads'
import { getShippingQuoter, onlyDigits, type ShippingQuoter } from '../shipping'

const PIX_TTL_MS = 30 * 60 * 1000

export type SimulatedOutcome = 'approved' | 'pending' | 'rejected'

/** Endereços públicos do site, resolvidos pela rota a partir da requisição (ou de APP_URL). */
export interface CheckoutUrls {
  /** Origem do site para onde o cliente volta, ex.: https://festinhas.com.br */
  origin: string
  /** URL pública do webhook (em desenvolvimento, a de um túnel). null = usar a configurada no painel do MP. */
  notificationUrl: string | null
}

async function toPublicOrder(db: Db, orderId: string): Promise<PublicOrder> {
  const [row] = await db
    .select({ order: t.orders, pkg: { title: t.packages.title, slug: t.packages.slug, kind: t.packages.kind } })
    .from(t.orders)
    .leftJoin(t.packages, eq(t.orders.packageId, t.packages.id))
    .where(eq(t.orders.id, orderId))
  if (!row) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
  const { order, pkg } = row
  const [user] = await db.select({ createdAt: t.users.createdAt }).from(t.users).where(eq(t.users.email, order.email))
  const viaMp = !!order.mpPreferenceId
  const pending = order.status === 'pending'

  return {
    id: order.id,
    status: order.status,
    method: order.method,
    amountCents: order.amountCents,
    email: order.email,
    packageTitle: pkg?.title ?? 'Pacote',
    packageSlug: pkg?.slug ?? '',
    packageKind: pkg?.kind ?? 'digital',
    deliveryMethod: order.deliveryMethod,
    productionStatus: order.productionStatus,
    createdAt: order.createdAt.toISOString(),
    existingAccount: !!user && user.createdAt < order.createdAt,
    provider: viaMp ? 'mercadopago' : 'simulator',
    resumeUrl: viaMp && pending ? order.mpCheckoutUrl : null,
    pix:
      !viaMp && order.method === 'pix' && pending
        ? {
            copyPaste: `00020126580014BR.GOV.BCB.PIX0136festinhas-${order.id}5204000053039865406${(order.amountCents / 100).toFixed(2)}5802BR`,
            expiresAt: new Date(order.createdAt.getTime() + PIX_TTL_MS).toISOString(),
          }
        : null,
  }
}

interface OrderData {
  name: string
  email: string
  phone: string
  method?: PaymentMethod
  customization: Customization | null
  deliveryMethod: DeliveryMethod
  shippingAddress: ShippingAddress | null
  shipping: ShippingChoice | null
  variant: PackageVariant | null
}

type PackageRow = typeof t.packages.$inferSelect

/**
 * Confere a personalização e a entrega exigidas pelo tipo de pacote.
 * Devolve só o que vale para este pacote (ex.: kit pronto não guarda personalização) e os erros por campo.
 */
async function orderExtras(
  db: Db,
  pkg: PackageRow,
  input: Pick<CheckoutInput, 'customization' | 'deliveryMethod' | 'shippingAddress' | 'shippingServiceId' | 'variantId'>,
  quoter: ShippingQuoter,
) {
  const errors: Record<string, string> = {}

  // Opção de quantidade/preço (quando o pacote tem opções).
  const { priceCents, variant } = priceFor(pkg, input.variantId)
  if (pkg.variants.length && !variant) errors.variantId = 'Escolha a quantidade.'

  let customization: Customization | null = null
  if (needsCustomization(pkg)) {
    const c = { childName: '', age: '', theme: '', colors: '', notes: '', businessName: '', cardText: '', ...input.customization }
    if (isBusiness(pkg)) {
      if (!c.businessName.trim()) errors.businessName = 'Informe o nome da empresa ou marca.'
    } else {
      if (needsName(pkg) && !c.childName.trim()) errors.childName = 'Informe o nome que vai na arte.'
      if (!c.theme.trim()) errors.theme = 'Informe o tema da festa.'
    }
    customization = c
  }

  let deliveryMethod: DeliveryMethod = 'download'
  let shippingAddress: ShippingAddress | null = null
  let shipping: ShippingChoice | null = null
  if (pkg.kind === 'printed') {
    if (input.deliveryMethod !== 'pickup' && input.deliveryMethod !== 'shipping') errors.deliveryMethod = 'Escolha retirada ou envio.'
    else deliveryMethod = input.deliveryMethod
    if (deliveryMethod === 'shipping') {
      const a = { postalCode: '', street: '', number: '', complement: '', district: '', city: '', state: '', ...input.shippingAddress }
      shippingAddress = {
        postalCode: onlyDigits(a.postalCode),
        street: a.street.trim(),
        number: a.number.trim(),
        complement: a.complement.trim(),
        district: a.district.trim(),
        city: a.city.trim(),
        state: a.state.trim().toUpperCase(),
      }
      if (shippingAddress.postalCode.length !== 8) errors.postalCode = 'Informe um CEP com 8 dígitos.'
      if (!shippingAddress.street) errors.street = 'Informe a rua.'
      if (!shippingAddress.number) errors.number = 'Informe o número (ou "s/n").'
      if (!shippingAddress.district) errors.district = 'Informe o bairro.'
      if (!shippingAddress.city) errors.city = 'Informe a cidade.'
      if (!/^[A-Z]{2}$/.test(shippingAddress.state)) errors.state = 'UF com 2 letras.'
      if (!input.shippingServiceId) errors.shippingServiceId = 'Escolha uma opção de envio.'

      // O frete é sempre recalculado aqui: o valor do navegador nunca é usado.
      if (!errors.postalCode && input.shippingServiceId) {
        try {
          const options = await quotePackage(db, pkg, shippingAddress.postalCode, quoter, priceCents)
          shipping = options.find((o) => o.serviceId === input.shippingServiceId) ?? null
          if (!shipping) errors.shippingServiceId = 'Esta opção de envio não está mais disponível. Escolha outra.'
        } catch (err) {
          if (!(err instanceof ServiceError)) throw err
          if (err.code === 'VALIDATION' || err.code === 'NOT_FOUND') errors.postalCode = err.details?.postalCode ?? err.message
          else throw err
        }
      }
    }
  }
  return { errors, data: { customization, deliveryMethod, shippingAddress, shipping, variant } }
}

/** Cria o pedido pendente e, com Mercado Pago, a preferência de pagamento. */
async function openOrder(
  db: Db,
  data: OrderData,
  pkg: PackageRow,
  urls: CheckoutUrls | null,
  gateway: PaymentGateway,
  uploads: { id: string; token: string }[] = [],
) {
  const id = newId('ord')
  // O preço vem sempre do banco (da opção escolhida, se houver) e o frete, da cotação feita no servidor.
  const amountCents = (data.variant?.priceCents ?? pkg.priceCents) + (data.shipping?.priceCents ?? 0)
  // Pedido e arquivos do cliente juntos: se o logo não for aceito, o pedido não é criado.
  await db.transaction(async (tx) => {
    await tx.insert(t.orders).values({ id, ...data, packageId: pkg.id, amountCents })
    await attachUploads(tx, id, uploads)
  })

  if (gateway.kind === 'simulator' || !urls) return { orderId: id, checkoutUrl: `/simulador-mp/${id}` }

  const checkout = await gateway.createCheckout({
    orderId: id,
    title: data.variant ? `${pkg.title} – ${data.variant.label}` : pkg.title,
    packageId: pkg.id,
    amountCents,
    shipping: data.shipping ? { title: `Frete ${[data.shipping.company, data.shipping.service].filter(Boolean).join(' ')}`, cents: data.shipping.priceCents } : null,
    payer: { name: data.name, email: data.email },
    returnUrl: `${urls.origin}/checkout/retorno?pedido=${id}`,
    notificationUrl: urls.notificationUrl,
  })
  if (!checkout) throw new ServiceError('NETWORK', 'Não foi possível iniciar o pagamento. Tente novamente.')
  await db.update(t.orders).set({ mpPreferenceId: checkout.preferenceId, mpCheckoutUrl: checkout.checkoutUrl }).where(eq(t.orders.id, id))
  return { orderId: id, checkoutUrl: checkout.checkoutUrl }
}

export async function createOrder(
  db: Db,
  input: CheckoutInput,
  urls: CheckoutUrls | null = null,
  gateway: PaymentGateway = getPaymentGateway(),
  quoter: ShippingQuoter = getShippingQuoter(),
) {
  const [pkg] = await db
    .select()
    .from(t.packages)
    .where(and(eq(t.packages.slug, String(input.packageSlug ?? '')), eq(t.packages.active, true)))
  if (!pkg) throw new ServiceError('NOT_FOUND', 'Este pacote não está mais disponível.')

  // Todos os erros de uma vez (dados pessoais + personalização + entrega), para o cliente corrigir num passo só.
  const parsed = checkoutSchema.safeParse(input)
  const extras = await orderExtras(db, pkg, parsed.success ? parsed.data : input, quoter)
  const errors = { ...(parsed.success ? {} : zodDetails(parsed.error)), ...extras.errors }
  if (!parsed.success || Object.keys(errors).length) throw new ServiceError('VALIDATION', 'Revise os campos destacados.', errors)

  const { name, email, phone } = parsed.data
  return openOrder(db, { name, email, phone, ...extras.data }, pkg, urls, gateway, parsed.data.uploads ?? [])
}

/**
 * Status público de um pedido (quem tem o ID do pedido pode consultar, como no retorno do Mercado Pago).
 * `paymentId`: o MP devolve o cliente com ?payment_id=…; consultamos na hora para não depender só do webhook.
 */
export async function getOrder(db: Db, orderId: string, { paymentId }: { paymentId?: string | null } = {}, gateway: PaymentGateway = getPaymentGateway()) {
  const [order] = await db
    .select({ status: t.orders.status, viaMp: t.orders.mpPreferenceId, simulatedApproveAt: t.orders.simulatedApproveAt })
    .from(t.orders)
    .where(eq(t.orders.id, orderId))
  if (!order) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')

  if (order.status === 'pending' && order.viaMp && paymentId && gateway.kind === 'mercadopago') {
    try {
      const payment = await gateway.getPayment(paymentId)
      // Só aplica se o pagamento é mesmo deste pedido.
      if (payment?.externalReference === orderId) await applyPayment(db, payment)
    } catch (err) {
      // Sem problema: o webhook e a conciliação resolvem depois.
      console.error('[retorno] falha ao consultar pagamento no MP', orderId, err)
    }
  }

  // Simulador: confirma Pix pendentes cujo prazo simulado já passou.
  const [due] = await db
    .select({ id: t.orders.id })
    .from(t.orders)
    .where(and(eq(t.orders.id, orderId), eq(t.orders.status, 'pending'), isNotNull(t.orders.simulatedApproveAt), lte(t.orders.simulatedApproveAt, new Date())))
  if (due) await db.transaction((tx) => approveOrder(tx, orderId))
  return toPublicOrder(db, orderId)
}

/** Faz o papel da página de pagamento do Mercado Pago. Só existe com o modo de simulação ligado. */
export async function simulatePayment(
  db: Db,
  orderId: string,
  method: PaymentMethod,
  { outcome, pixAutoConfirmSeconds }: { outcome: SimulatedOutcome; pixAutoConfirmSeconds: number },
) {
  const returnUrl = `/checkout/retorno?pedido=${orderId}`
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(t.orders).where(eq(t.orders.id, orderId)).for('update')
    if (!order) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
    if (order.mpPreferenceId) throw new ServiceError('CONFLICT', 'Este pedido é pago pelo Mercado Pago, não pelo simulador.')
    if (order.status !== 'pending') return

    if (outcome === 'rejected') {
      await tx.update(t.orders).set({ method, status: 'rejected' }).where(eq(t.orders.id, orderId))
    } else if (outcome === 'pending' && method === 'pix') {
      const at = pixAutoConfirmSeconds > 0 ? new Date(Date.now() + pixAutoConfirmSeconds * 1000) : null
      await tx.update(t.orders).set({ method, simulatedApproveAt: at }).where(eq(t.orders.id, orderId))
    } else {
      await tx.update(t.orders).set({ method }).where(eq(t.orders.id, orderId))
      await approveOrder(tx, orderId)
    }
  })
  return { returnUrl }
}

/** Tentar de novo após recusa/expiração: novo pedido com os mesmos dados (e o preço atual). */
export async function retry(db: Db, orderId: string, urls: CheckoutUrls | null = null, gateway: PaymentGateway = getPaymentGateway()) {
  const [old] = await db.select().from(t.orders).where(eq(t.orders.id, orderId))
  if (!old) throw new ServiceError('NOT_FOUND', 'Pedido não encontrado.')
  const [pkg] = await db.select().from(t.packages).where(and(eq(t.packages.id, old.packageId), eq(t.packages.active, true)))
  if (!pkg) throw new ServiceError('NOT_FOUND', 'Este pacote não está mais disponível.')
  const data = {
    name: old.name,
    email: old.email,
    phone: old.phone,
    method: old.method,
    customization: old.customization ?? null,
    deliveryMethod: old.deliveryMethod,
    shippingAddress: old.shippingAddress ?? null,
    // Mantém o frete e a opção escolhidos na primeira tentativa (os arquivos enviados continuam no pedido antigo).
    shipping: old.shipping ?? null,
    variant: old.variant ?? null,
  }
  return openOrder(db, data, pkg, urls, gateway)
}

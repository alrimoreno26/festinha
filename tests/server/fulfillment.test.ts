import * as account from '@/lib/server/domain/account'
import * as auth from '@/lib/server/domain/auth'
import * as checkout from '@/lib/server/domain/checkout'
import { approveOrder } from '@/lib/server/domain/fulfillment'
import * as orders from '@/lib/server/domain/orders'
import { toUser } from '@/lib/server/mappers'
import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createSeededDb, emailsTo, t, tempPasswordIn } from '../helpers/db'

const DAY = 24 * 60 * 60 * 1000
const buyer = { name: 'Beatriz Teste', email: 'Beatriz@Festinhas.test', phone: '(48) 99123-4567' }

describe('compra de cliente novo', () => {
  it('cria a conta com senha temporária, libera o acesso e envia o email', async () => {
    const { db } = await createSeededDb()
    const { orderId } = await checkout.createOrder(db, { packageSlug: 'kit-fundo-do-mar', ...buyer })
    const result = await db.transaction((tx) => approveOrder(tx, orderId))
    expect(result).toMatchObject({ approved: true, createdUser: true })

    const [user] = await db.select().from(t.users).where(eq(t.users.email, 'beatriz@festinhas.test'))
    expect(user).toMatchObject({ role: 'customer', mustChangePassword: true, name: 'Beatriz Teste' })

    const [ent] = await db.select().from(t.entitlements).where(eq(t.entitlements.userId, user.id))
    // Kit Fundo do Mar tem 30 dias de acesso.
    expect(ent.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 29 * DAY)
    expect(ent.orderId).toBe(orderId)

    const [email] = await emailsTo(db, user.email)
    const temp = tempPasswordIn(email.body)
    expect(temp).toBeTruthy()
    // A senha do email realmente funciona.
    const session = await auth.login(db, user.email, temp!)
    expect(session.user.mustChangePassword).toBe(true)
  })

  it('é idempotente: aprovar duas vezes não duplica acesso nem email', async () => {
    const { db } = await createSeededDb()
    const { orderId } = await checkout.createOrder(db, { packageSlug: 'kit-safari', ...buyer })
    await db.transaction((tx) => approveOrder(tx, orderId))
    const second = await db.transaction((tx) => approveOrder(tx, orderId))
    expect(second).toMatchObject({ approved: false, reason: 'already_approved' })

    const [user] = await db.select().from(t.users).where(eq(t.users.email, 'beatriz@festinhas.test'))
    expect(await db.select().from(t.entitlements).where(eq(t.entitlements.userId, user.id))).toHaveLength(1)
    expect(await emailsTo(db, user.email)).toHaveLength(1)
  })
})

describe('recompra de cliente existente', () => {
  it('não cria conta nova e soma os dias ao vencimento atual', async () => {
    const { db, maria } = await createSeededDb()
    const [before] = await db
      .select()
      .from(t.entitlements)
      .where(and(eq(t.entitlements.userId, maria.id), eq(t.entitlements.packageId, 'pkg_mar')))
    const { orderId } = await checkout.createOrder(db, { packageSlug: 'kit-fundo-do-mar', name: maria.name, email: maria.email, phone: '(48) 99999-1111' })
    const result = await db.transaction((tx) => approveOrder(tx, orderId))
    expect(result).toMatchObject({ approved: true, createdUser: false })

    const [after] = await db.select().from(t.entitlements).where(eq(t.entitlements.id, before.id))
    // Vencia em ~5 dias; comprou mais 30 → ~35 dias a partir de hoje (e não 30).
    expect(after.expiresAt!.getTime() - before.expiresAt!.getTime()).toBe(30 * DAY)
    const [email] = await emailsTo(db, maria.email)
    expect(tempPasswordIn(email.body)).toBeUndefined()
  })

  it('acesso vencido renova a partir de hoje', async () => {
    const { db, maria } = await createSeededDb()
    const { orderId } = await checkout.createOrder(db, { packageSlug: 'kit-princesas', name: maria.name, email: maria.email, phone: '(48) 99999-1111' })
    await db.transaction((tx) => approveOrder(tx, orderId))
    const kit = await account.myKit(db, maria, 'pkg_princesas')
    expect(kit.status).toBe('active')
    expect(new Date(kit.entitlement.expiresAt!).getTime()).toBeGreaterThan(Date.now() + 29 * DAY)
    expect(kit.files.length).toBeGreaterThan(0)
  })
})

describe('reembolso e chargeback', () => {
  it('reembolso revoga o acesso e bloqueia o download', async () => {
    const { db, admin } = await createSeededDb()
    const { orderId } = await checkout.createOrder(db, { packageSlug: 'kit-futebol', ...buyer })
    await db.transaction((tx) => approveOrder(tx, orderId))
    const [row] = await db.select().from(t.users).where(eq(t.users.email, 'beatriz@festinhas.test'))
    const beatriz = toUser(row)

    await expect(account.authorizeDownload(db, beatriz, 'fil_fut1')).resolves.toMatchObject({ id: 'fil_fut1' })
    await orders.refund(db, admin, orderId)

    const detail = await orders.get(db, admin, orderId)
    expect(detail.order.status).toBe('refunded')
    expect(detail.entitlement?.status).toBe('revoked')
    await expect(account.authorizeDownload(db, beatriz, 'fil_fut1')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('não permite reembolsar pedido pendente nem aprovar pedido já aprovado', async () => {
    const { db, admin } = await createSeededDb()
    await expect(orders.refund(db, admin, 'ord_1008')).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(orders.approve(db, admin, 'ord_1001')).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('checkout', () => {
  it('usa o preço do banco e recusa pacote inativo', async () => {
    const { db } = await createSeededDb()
    const { orderId } = await checkout.createOrder(db, { packageSlug: 'kit-safari', ...buyer })
    const [order] = await db.select().from(t.orders).where(eq(t.orders.id, orderId))
    expect(order.amountCents).toBe(4990)
    expect(order.email).toBe('beatriz@festinhas.test')
    await expect(checkout.createOrder(db, { packageSlug: 'kit-unicornio', ...buyer })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('valida os dados do comprador', async () => {
    const { db } = await createSeededDb()
    await expect(checkout.createOrder(db, { packageSlug: 'kit-safari', name: 'A', email: 'nao-e-email', phone: '123' })).rejects.toMatchObject({
      code: 'VALIDATION',
      details: { name: expect.any(String), email: expect.any(String), phone: expect.any(String) },
    })
  })

  it('Pix pendente é confirmado quando o prazo simulado passa', async () => {
    const { db } = await createSeededDb()
    const { orderId } = await checkout.createOrder(db, { packageSlug: 'kit-safari', ...buyer })
    await checkout.simulatePayment(db, orderId, 'pix', { outcome: 'pending', pixAutoConfirmSeconds: 60 })
    expect((await checkout.getOrder(db, orderId)).status).toBe('pending')

    await db.update(t.orders).set({ simulatedApproveAt: new Date(Date.now() - 1000) }).where(eq(t.orders.id, orderId))
    const order = await checkout.getOrder(db, orderId)
    expect(order.status).toBe('approved')
    expect(order.existingAccount).toBe(false)
  })

  it('pagamento recusado não libera nada e permite tentar de novo', async () => {
    const { db } = await createSeededDb()
    const { orderId } = await checkout.createOrder(db, { packageSlug: 'kit-safari', ...buyer })
    await checkout.simulatePayment(db, orderId, 'card', { outcome: 'rejected', pixAutoConfirmSeconds: 0 })
    expect((await checkout.getOrder(db, orderId)).status).toBe('rejected')
    expect(await db.select().from(t.users).where(eq(t.users.email, 'beatriz@festinhas.test'))).toHaveLength(0)

    const retry = await checkout.retry(db, orderId)
    expect(retry.orderId).not.toBe(orderId)
    expect((await checkout.getOrder(db, retry.orderId)).status).toBe('pending')
  })
})

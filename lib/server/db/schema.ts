// Esquema do banco (Drizzle + Postgres/Neon).
// Espelha os tipos de lib/types.ts. IDs são texto com prefixo (ex.: "ord_…"), gerados na aplicação,
// para ficarem legíveis no suporte ("qual é o nº do seu pedido?").

import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const tstz = (name: string) => timestamp(name, { withTimezone: true })

export const roleEnum = pgEnum('role', ['admin', 'customer'])
export const orderStatusEnum = pgEnum('order_status', ['pending', 'approved', 'rejected', 'refunded', 'charged_back'])
export const paymentMethodEnum = pgEnum('payment_method', ['pix', 'card'])
export const grantTypeEnum = pgEnum('grant_type', ['purchase', 'manual'])

// ---------------------------------------------------------------------------
// Usuários e autenticação
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  /** Sempre gravado em minúsculas. */
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  role: roleEnum('role').notNull().default('customer'),
  passwordHash: text('password_hash').notNull(),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
})

/** Sessões de login. O `id` é o SHA-256 do token do cookie — o token em si nunca é gravado. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: tstz('expires_at').notNull(),
    createdAt: createdAt(),
    userAgent: text('user_agent'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

/** Links de "esqueci minha senha". Guardamos só o hash do token; uso único. */
export const passwordResets = pgTable(
  'password_resets',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: tstz('expires_at').notNull(),
    usedAt: tstz('used_at'),
    createdAt: createdAt(),
  },
  (t) => [index('password_resets_user_idx').on(t.userId)],
)

/** Tentativas de login, para limitar força bruta por email. */
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    success: boolean('success').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('login_attempts_email_created_idx').on(t.email, t.createdAt)],
)

// ---------------------------------------------------------------------------
// Arquivos (metadados do que está no R2) e pacotes
// ---------------------------------------------------------------------------

/** Pastas criadas explicitamente (pastas com arquivos também são derivadas das keys). */
export const folders = pgTable('folders', {
  path: text('path').primaryKey(),
  createdAt: createdAt(),
})

export const files = pgTable('files', {
  id: text('id').primaryKey(),
  /** Caminho completo no bucket, ex.: kits/safari/topo-de-bolo.pdf */
  key: text('key').notNull().unique(),
  filename: text('filename').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  mime: text('mime').notNull(),
  createdAt: createdAt(),
})

export const packages = pgTable(
  'packages',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    coverUrl: text('cover_url'),
    priceCents: integer('price_cents').notNull(),
    active: boolean('active').notNull().default(false),
    /** Dias de acesso após a compra. null = vitalício. */
    accessDays: integer('access_days'),
    createdAt: createdAt(),
    updatedAt: tstz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('packages_price_min', sql`${t.priceCents} >= 100`),
    check('packages_access_days_positive', sql`${t.accessDays} is null or ${t.accessDays} > 0`),
  ],
)

export const packageFiles = pgTable(
  'package_files',
  {
    packageId: text('package_id')
      .notNull()
      .references(() => packages.id, { onDelete: 'cascade' }),
    fileId: text('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    /** Ordem de exibição dentro do pacote. */
    position: integer('position').notNull(),
  },
  (t) => [primaryKey({ columns: [t.packageId, t.fileId] }), index('package_files_file_idx').on(t.fileId)],
)

// ---------------------------------------------------------------------------
// Vendas e acessos
// ---------------------------------------------------------------------------

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    /** Preenchido quando o pagamento é aprovado (a conta é criada nesse momento). */
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    packageId: text('package_id')
      .notNull()
      .references(() => packages.id, { onDelete: 'restrict' }),
    amountCents: integer('amount_cents').notNull(),
    status: orderStatusEnum('status').notNull().default('pending'),
    method: paymentMethodEnum('method').notNull().default('pix'),
    createdAt: createdAt(),
    paidAt: tstz('paid_at'),
    // Mercado Pago
    mpPreferenceId: text('mp_preference_id'),
    /** Link do checkout do MP (para o cliente voltar a um pagamento pendente). */
    mpCheckoutUrl: text('mp_checkout_url'),
    mpPaymentId: text('mp_payment_id').unique(),
    /** Último status/detalhe informado pelo MP (ex.: "rejected/cc_rejected_insufficient_amount"), para suporte. */
    mpStatus: text('mp_status'),
    /** Só no simulador (sem MP configurado): quando um Pix pendente deve ser "confirmado". */
    simulatedApproveAt: tstz('simulated_approve_at'),
  },
  (t) => [
    index('orders_email_idx').on(t.email),
    index('orders_status_idx').on(t.status),
    index('orders_created_idx').on(t.createdAt),
    check('orders_amount_non_negative', sql`${t.amountCents} >= 0`),
  ],
)

export const entitlements = pgTable(
  'entitlements',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    packageId: text('package_id')
      .notNull()
      .references(() => packages.id, { onDelete: 'restrict' }),
    orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
    grantedBy: grantTypeEnum('granted_by').notNull(),
    createdAt: createdAt(),
    expiresAt: tstz('expires_at'),
    revokedAt: tstz('revoked_at'),
  },
  // Um acesso por cliente+pacote: recomprar renova o mesmo registro.
  (t) => [uniqueIndex('entitlements_user_package_uq').on(t.userId, t.packageId), index('entitlements_order_idx').on(t.orderId)],
)

export const downloads = pgTable(
  'downloads',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fileId: text('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [index('downloads_user_idx').on(t.userId, t.createdAt)],
)

/** Emails transacionais. Até a fase 5 só ficam aqui (a DevToolbar mostra); depois viram histórico de envio. */
export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: text('id').primaryKey(),
    to: text('to').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    actionUrl: text('action_url'),
    actionLabel: text('action_label'),
    createdAt: createdAt(),
    sentAt: tstz('sent_at'),
    providerId: text('provider_id'),
    /** Tentativas de envio (para de tentar depois de algumas falhas). */
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    /** Próxima tentativa (espera cresce a cada falha). */
    nextAttemptAt: tstz('next_attempt_at').notNull().defaultNow(),
  },
  (t) => [index('email_outbox_created_idx').on(t.createdAt), index('email_outbox_pending_idx').on(t.sentAt, t.nextAttemptAt)],
)

/**
 * Avisos recebidos dos webhooks (Mercado Pago). Servem para não processar o mesmo aviso duas vezes
 * e para investigar problemas ("o MP avisou? o que respondemos?").
 */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: serial('id').primaryKey(),
    provider: text('provider').notNull(),
    /** Identificador único do aviso (x-request-id do MP). */
    eventKey: text('event_key').notNull(),
    topic: text('topic'),
    resourceId: text('resource_id'),
    payload: text('payload').notNull(),
    receivedAt: createdAt(),
    processedAt: tstz('processed_at'),
    error: text('error'),
  },
  (t) => [uniqueIndex('webhook_events_provider_key_uq').on(t.provider, t.eventKey), index('webhook_events_resource_idx').on(t.resourceId)],
)

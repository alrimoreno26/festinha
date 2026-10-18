// Frete de um pacote impresso até o CEP do cliente.

import { priceFor } from '@/lib/contracts'
import { ServiceError } from '@/lib/services/errors'
import type { ShippingChoice } from '@/lib/types'
import { and, eq } from 'drizzle-orm'
import * as t from '../db/schema'
import type { Db } from '../db/types'
import { getShippingQuoter, onlyDigits, quoteCached, ShippingError, type ShippingQuoter } from '../shipping'
import { notifyTelegram } from '../telegram'

type PackageRow = typeof t.packages.$inferSelect

/** O pacote oferece envio? (impresso com medidas cadastradas e frete configurado) */
export const canShip = (pkg: Pick<PackageRow, 'kind' | 'shippingBox'>, quoter: ShippingQuoter = getShippingQuoter()) =>
  pkg.kind === 'printed' && !!pkg.shippingBox && quoter.kind !== 'none'

// Um aviso por hora no Telegram quando o Melhor Envio recusa nossa configuração (ex.: token vencido).
const ALERT_EVERY_MS = 60 * 60_000
let lastAlertAt = 0

async function alertConfigProblem(db: Db, message: string) {
  if (Date.now() - lastAlertAt < ALERT_EVERY_MS) return
  lastAlertAt = Date.now()
  await notifyTelegram(
    db,
    `⚠️ <b>Frete indisponível no site</b>\n\nO Melhor Envio recusou a cotação: ${message.replace(/[<>&]/g, '')}.\nOs clientes só conseguem escolher retirada até isso ser resolvido. Confira o token (MELHORENVIO_TOKEN) e o CEP de origem.`,
  ).catch((err) => console.error('[frete] falha ao avisar no Telegram', err))
}

/** Cotação para o pacote (já carregado). Erros viram ServiceError com mensagem para o cliente. */
export async function quotePackage(
  db: Db,
  pkg: PackageRow,
  postalCode: string,
  quoter: ShippingQuoter = getShippingQuoter(),
  /** Valor declarado: o preço da opção escolhida (ou o preço único). */
  priceCents: number = pkg.priceCents,
): Promise<ShippingChoice[]> {
  const cep = onlyDigits(postalCode)
  if (cep.length !== 8) throw new ServiceError('VALIDATION', 'Informe um CEP válido.', { postalCode: 'Informe um CEP com 8 dígitos.' })
  if (!canShip(pkg, quoter)) throw new ServiceError('CONFLICT', 'Este kit não tem envio disponível. Escolha a retirada.')

  const box = pkg.shippingBox!
  const key = [pkg.id, cep, box.weightGrams, box.heightCm, box.widthCm, box.lengthCm, priceCents].join(':')
  try {
    const options = await quoteCached(quoter, key, { toPostalCode: cep, box, insuranceCents: priceCents })
    if (!options.length)
      throw new ServiceError('NOT_FOUND', 'Nenhuma transportadora atende este CEP para este pacote. Confira o CEP ou escolha a retirada.', {
        postalCode: 'Sem opções de envio para este CEP.',
      })
    return options
  } catch (err) {
    if (err instanceof ServiceError) throw err
    if (err instanceof ShippingError) {
      if (err.configProblem) {
        console.error('[frete] configuração recusada pelo Melhor Envio', err.message)
        await alertConfigProblem(db, err.message)
        throw new ServiceError('NETWORK', 'Não conseguimos calcular o frete agora. Tente novamente em alguns minutos ou escolha a retirada.')
      }
      if (err.message === 'CEP de destino inválido.') throw new ServiceError('VALIDATION', 'CEP não encontrado.', { postalCode: 'CEP não encontrado.' })
    }
    console.error('[frete] falha na cotação', err)
    throw new ServiceError('NETWORK', 'Não conseguimos calcular o frete agora. Tente novamente em alguns minutos ou escolha a retirada.')
  }
}

/** Rota pública: cotação pelo slug do pacote. */
export async function quoteBySlug(db: Db, slug: string, postalCode: string, quoter: ShippingQuoter = getShippingQuoter(), variantId?: string | null) {
  const [pkg] = await db
    .select()
    .from(t.packages)
    .where(and(eq(t.packages.slug, slug), eq(t.packages.active, true)))
  if (!pkg) throw new ServiceError('NOT_FOUND', 'Este pacote não está mais disponível.')
  const { priceCents } = priceFor(pkg, variantId)
  return { options: await quotePackage(db, pkg, postalCode, quoter, priceCents) }
}

/** Só para testes: zera o controle de avisos. */
export function resetShippingAlerts() {
  lastAlertAt = 0
}

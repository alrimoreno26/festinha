import * as payments from '@/lib/server/domain/payments'
import { db, route } from '@/lib/server/http'
import { ServiceError } from '@/lib/services/errors'

/**
 * Conciliação automática (Vercel Cron). A Vercel manda "Authorization: Bearer <CRON_SECRET>".
 * Rede de segurança para avisos do webhook que não chegaram.
 */
export const GET = route(async ({ req }) => {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) throw new ServiceError('UNAUTHORIZED', 'Não autorizado.')
  return payments.reconcilePending(db)
})

export const maxDuration = 60

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

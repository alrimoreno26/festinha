import * as payments from '@/lib/server/domain/payments'
import { db, route } from '@/lib/server/http'
import { NextResponse } from 'next/server'

/**
 * Avisos do Mercado Pago. Vem de outro servidor: sem checagem de Origin (csrf: false);
 * a autenticidade é garantida pela assinatura x-signature, validada no domínio.
 * Responde 200 rápido; erro → 500 e o MP tenta de novo.
 */
export const POST = route(
  async ({ req }) => {
    let body: Record<string, unknown> | null = null
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      // aviso sem corpo (formato antigo, só query string)
    }
    const { status, result } = await payments.handleMpWebhook(db, {
      signature: req.headers.get('x-signature'),
      requestId: req.headers.get('x-request-id'),
      query: req.nextUrl.searchParams,
      body,
    })
    return NextResponse.json({ result }, { status })
  },
  { csrf: false },
)

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'

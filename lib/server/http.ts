import 'server-only'

import { ServiceError, type ServiceErrorCode } from '@/lib/services/errors'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import type { z } from 'zod'
import { db } from './db'
import * as auth from './domain/auth'
import type { Actor } from './guards'

export const SESSION_COOKIE = 'fs_session'

const STATUS: Record<ServiceErrorCode, number> = {
  NETWORK: 503,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
}

export interface ApiErrorBody {
  error: { code: ServiceErrorCode; message: string; details?: Record<string, string> }
}

/** Erros de controle do próprio Next (redirect, notFound, uso dinâmico no build) precisam seguir adiante. */
function isNextInternal(err: unknown) {
  const digest = (err as { digest?: unknown } | null)?.digest
  return typeof digest === 'string' && (digest.startsWith('NEXT_') || digest === 'DYNAMIC_SERVER_USAGE')
}

function errorResponse(err: unknown) {
  if (isNextInternal(err)) throw err
  if (err instanceof ServiceError) {
    const body: ApiErrorBody = { error: { code: err.code, message: err.message, details: err.details } }
    return NextResponse.json(body, { status: STATUS[err.code] })
  }
  console.error('[api] erro inesperado', err)
  const body: ApiErrorBody = { error: { code: 'NETWORK', message: 'Erro interno. Tente novamente em instantes.' } }
  return NextResponse.json(body, { status: 500 })
}

export function setSessionCookie(token: string, expiresAt: Date) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE)
}

/** Resolve o usuário do cookie. Renova o cookie se a sessão foi renovada; apaga se era inválida. */
async function resolveSession(): Promise<{ actor: Actor; token: string | null }> {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (!token) return { actor: null, token: null }
  const session = await auth.validateSession(db, token)
  if (!session) {
    clearSessionCookie()
    return { actor: null, token: null }
  }
  if (session.renewed) setSessionCookie(token, session.expiresAt)
  return { actor: session.user, token }
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Proteção CSRF: pedidos que alteram dados precisam vir do próprio site.
 * (O cookie já é SameSite=Lax; isto fecha o resto.) Webhooks desligam com `csrf: false`.
 */
function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin || origin !== req.nextUrl.origin) throw new ServiceError('FORBIDDEN', 'Origem da requisição não permitida.')
}

export interface RouteContext<P> {
  req: NextRequest
  params: P
  actor: Actor
  /** Token da sessão atual (para operações que precisam saber qual sessão manter). */
  sessionToken: string | null
}

/** Envolve um route handler: sessão, CSRF, JSON e tradução de erros. */
export function route<P = Record<string, never>>(fn: (ctx: RouteContext<P>) => Promise<unknown>, { csrf = true } = {}) {
  return async (req: NextRequest, { params }: { params: P }) => {
    try {
      if (csrf && MUTATING.has(req.method)) assertSameOrigin(req)
      const { actor, token } = await resolveSession()
      const result = await fn({ req, params, actor, sessionToken: token })
      if (result instanceof Response) return result
      return NextResponse.json(result ?? null, { headers: { 'Cache-Control': 'no-store' } })
    } catch (err) {
      return errorResponse(err)
    }
  }
}

/** Lê e valida o corpo JSON. */
export async function body<S extends z.ZodTypeAny>(req: NextRequest, schema: S): Promise<z.output<S>> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ServiceError('VALIDATION', 'Corpo da requisição inválido.')
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const details = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0] ?? 'body'), i.message]))
    throw new ServiceError('VALIDATION', 'Dados inválidos.', details)
  }
  return parsed.data
}

/**
 * Endpoints de simulação: ligados em desenvolvimento; em builds de produção só com DEV_TOOLS=true
 * (ex.: preview da Vercel). No ambiente Production da Vercel ficam SEMPRE desligados, mesmo que a
 * variável tenha sido configurada lá por engano — eles permitem entrar como admin sem senha.
 */
export function devToolsEnabled() {
  if (process.env.VERCEL_ENV === 'production') return false
  return process.env.NODE_ENV !== 'production' ? process.env.DEV_TOOLS !== 'false' : process.env.DEV_TOOLS === 'true'
}

export function devOnly() {
  if (!devToolsEnabled()) throw new ServiceError('NOT_FOUND', 'Não encontrado.')
}

export { db }

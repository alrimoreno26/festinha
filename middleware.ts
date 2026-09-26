import { NextResponse, type NextRequest } from 'next/server'

// Redirecionamento rápido para o login quando não há cookie de sessão.
// É só uma otimização de navegação: quem decide o acesso de verdade são as rotas da API
// (que validam a sessão e o papel no banco a cada chamada).

const SESSION_COOKIE = 'fs_session'
const PUBLIC_CONTA = ['/conta/login', '/conta/esqueci-senha', '/conta/redefinir-senha']

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  if (PUBLIC_CONTA.some((p) => pathname.startsWith(p))) return NextResponse.next()
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next()

  const login = new URL('/conta/login', req.url)
  login.searchParams.set('next', pathname + search)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/admin/:path*', '/conta/:path*'],
}

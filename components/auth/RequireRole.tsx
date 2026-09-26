'use client'

// Guarda de navegação no cliente: decide o que mostrar enquanto a sessão carrega e para onde
// mandar quem não tem acesso. A permissão de verdade é verificada pela API em cada chamada.

import { ErrorState, PageLoader } from '@/components/ui'
import { useSession } from '@/lib/hooks/useSession'
import type { Role } from '@/lib/types'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'

interface RequireRoleProps {
  role: Role
  children: ReactNode
  /** Para onde mandar quem não está logado. */
  loginPath?: string
}

export function RequireRole({ role, children, loginPath = '/conta/login' }: RequireRoleProps) {
  const { user, isLoading, error, refetch } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const allowed = !!user && user.role === role
  const mustChangePassword = allowed && user.mustChangePassword && pathname !== '/conta/trocar-senha'

  useEffect(() => {
    // Erro de rede não é "deslogado": não redireciona, mostra o erro abaixo.
    if (isLoading || error) return
    if (!user) router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`)
    else if (user.role !== role) router.replace(user.role === 'admin' ? '/admin' : '/conta')
    else if (mustChangePassword) router.replace('/conta/trocar-senha')
  }, [isLoading, error, user, role, router, pathname, loginPath, mustChangePassword])

  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    )
  if (isLoading || !allowed || mustChangePassword) return <PageLoader label="Verificando acesso…" />
  return <>{children}</>
}

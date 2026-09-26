'use client'

// Proteção de rota no cliente para a fase de mocks.
// Na fase 2 será substituída por middleware + verificação no servidor.

import { PageLoader } from '@/components/ui'
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
  const { user, isLoading } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const allowed = !!user && user.role === role
  const mustChangePassword = allowed && user.mustChangePassword && pathname !== '/conta/trocar-senha'

  useEffect(() => {
    if (isLoading) return
    if (!user) router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`)
    else if (user.role !== role) router.replace(user.role === 'admin' ? '/admin' : '/conta')
    else if (mustChangePassword) router.replace('/conta/trocar-senha')
  }, [isLoading, user, role, router, pathname, loginPath, mustChangePassword])

  if (isLoading || !allowed || mustChangePassword) return <PageLoader label="Verificando acesso…" />
  return <>{children}</>
}

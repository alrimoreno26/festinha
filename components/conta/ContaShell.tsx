'use client'

import { cn } from '@/lib/cn'
import { useSession } from '@/lib/hooks/useSession'
import { authService, qk } from '@/lib/services'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut, Package, ReceiptText, UserRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

const nav = [
  { href: '/conta', label: 'Meus kits', icon: Package, match: (p: string) => p === '/conta' || p.startsWith('/conta/kits') },
  { href: '/conta/pedidos', label: 'Pedidos', icon: ReceiptText, match: (p: string) => p.startsWith('/conta/pedidos') },
  { href: '/conta/perfil', label: 'Minha conta', icon: UserRound, match: (p: string) => p.startsWith('/conta/perfil') || p.startsWith('/conta/trocar-senha') },
]

export function ContaShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useSession()
  // No primeiro acesso a pessoa só pode trocar a senha — a navegação fica escondida.
  const locked = !!user?.mustChangePassword

  const logout = async () => {
    await authService.logout()
    queryClient.setQueryData(qk.session, null)
    queryClient.removeQueries({ queryKey: ['me'] })
    router.replace('/conta/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-black/5">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <img src="/logo-festinhas.png" alt="" className="h-10 w-10 object-contain" />
            <div className="leading-tight">
              <p className="font-bold text-brand-coral">Festinhas</p>
              <p className="text-xs text-brand-teal">Área do Cliente</p>
            </div>
          </Link>
          {!locked && (
            <nav className="hidden sm:flex items-center gap-1">
              {nav.map(({ href, label, icon: Icon, match }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm',
                    match(pathname) ? 'bg-brand-blush text-brand-coral-dark font-medium' : 'text-gray-600 hover:bg-black/5',
                  )}
                >
                  <Icon size={16} /> {label}
                </Link>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-3">
            {user && <span className="hidden md:block text-sm text-gray-600 max-w-[160px] truncate">{user.name.split(' ')[0]}</span>}
            <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-black/5">
              <LogOut size={16} /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 pb-24 sm:pb-8">{children}</main>

      {/* Navegação inferior no celular */}
      {!locked && (
        <nav className="sm:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-black/5 grid grid-cols-3">
          {nav.map(({ href, label, icon: Icon, match }) => (
            <Link
              key={href}
              href={href}
              className={cn('flex flex-col items-center gap-0.5 py-2.5 text-xs', match(pathname) ? 'text-brand-coral font-medium' : 'text-gray-500')}
            >
              <Icon size={20} /> {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}

'use client'

import { cn } from '@/lib/cn'
import { useSession } from '@/lib/hooks/useSession'
import { authService, qk } from '@/lib/services'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink, FolderOpen, LayoutDashboard, LogOut, Menu, Package, ReceiptText, Users, X } from 'lucide-react'
import { hardNavigate } from '@/lib/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/pacotes', label: 'Pacotes', icon: Package },
  { href: '/admin/arquivos', label: 'Arquivos', icon: FolderOpen },
  { href: '/admin/pedidos', label: 'Pedidos', icon: ReceiptText },
  { href: '/admin/clientes', label: 'Clientes', icon: Users },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1">
      {nav.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm',
              active ? 'bg-brand-blush text-brand-coral-dark font-medium' : 'text-gray-600 hover:bg-black/5',
            )}
          >
            <Icon size={18} /> {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { user } = useSession()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])

  const logout = async () => {
    await authService.logout()
    queryClient.setQueryData(qk.session, null)
    queryClient.removeQueries({ queryKey: ['admin'] })
    hardNavigate('/conta/login')
  }

  const brand = (
    <Link href="/admin" className="flex items-center gap-2.5">
      <img src="/logo-festinhas.png" alt="" className="h-10 w-10 object-contain" />
      <div className="leading-tight">
        <p className="font-bold text-brand-coral">Festinhas</p>
        <p className="text-xs text-brand-teal">Backoffice</p>
      </div>
    </Link>
  )

  const footer = (
    <div className="space-y-1 border-t border-black/5 pt-4">
      <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-black/5">
        <ExternalLink size={16} /> Ver site
      </Link>
      <button onClick={logout} className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-black/5">
        <LogOut size={16} /> Sair
      </button>
      {user && <p className="px-3 pt-2 text-xs text-gray-400 truncate">{user.email}</p>}
    </div>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      {/* Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:gap-6 sticky top-0 h-screen border-r border-black/5 bg-white/70 p-4">
        {brand}
        <div className="flex-1">
          <NavLinks />
        </div>
        {footer}
      </aside>

      {/* Celular */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-black/5 bg-white/90 backdrop-blur px-4 h-16">
        {brand}
        <button onClick={() => setOpen(true)} className="rounded-full p-2 hover:bg-black/5" aria-label="Abrir menu">
          <Menu size={22} />
        </button>
      </header>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-72 max-w-[85vw] bg-white p-4 flex flex-col gap-6 shadow-xl">
            <div className="flex items-center justify-between">
              {brand}
              <button onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-black/5" aria-label="Fechar menu">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            {footer}
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  )
}

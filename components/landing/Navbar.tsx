'use client'

import { buttonClasses } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useSession } from '@/lib/hooks/useSession'
import { Menu, UserRound, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const links = [
  { label: 'Início', href: '/#hero' },
  { label: 'Kits digitais', href: '/pacotes' },
  { label: 'Serviços', href: '/#servicos' },
  { label: 'Galeria', href: '/#galeria' },
  { label: 'Contato', href: '/#contato' },
]

export default function Navbar() {
  const pathname = usePathname()
  const { user } = useSession()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])

  const accountHref = user?.role === 'admin' ? '/admin' : '/conta'
  const accountLabel = user ? (user.role === 'admin' ? 'Backoffice' : 'Meus kits') : 'Área do cliente'
  const isActive = (href: string) => href === '/pacotes' && pathname.startsWith('/pacotes')

  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-brand-sand/80 border-b border-amber-100">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo-festinhas.png" className="h-12 w-12 object-contain" alt="" />
          <div>
            <p className="text-xl font-bold text-brand-coral">Festinhas</p>
            <p className="text-sm -mt-1 text-brand-teal">Criativa Papelaria</p>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={cn('hover:opacity-80', isActive(l.href) && 'font-semibold text-brand-coral')}>
              {l.label}
            </Link>
          ))}
          <Link href={accountHref} className={buttonClasses('primary', 'sm', 'rounded-2xl px-4')}>
            <UserRound size={16} /> {accountLabel}
          </Link>
        </nav>
        <button
          className="md:hidden rounded-full p-2 hover:bg-black/5"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <nav className="md:hidden border-t border-amber-100 px-4 pb-4 pt-2 flex flex-col text-[15px]">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-2.5">
              {l.label}
            </Link>
          ))}
          <Link href={accountHref} className={buttonClasses('primary', 'md', 'mt-2')}>
            <UserRound size={16} /> {accountLabel}
          </Link>
        </nav>
      )}
    </header>
  )
}

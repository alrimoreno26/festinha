'use client'

import { BrandMark } from '@/components/brand/Decor'
import { buttonClasses } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useSession } from '@/lib/hooks/useSession'
import { Menu, UserRound, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const links = [
  { label: 'Início', href: '/#hero' },
  { label: 'Kits', href: '/pacotes' },
  { label: 'Como funciona', href: '/#como-funciona' },
  { label: 'Quem somos', href: '/#quem-somos' },
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
    <header className="sticky top-0 z-50 backdrop-blur bg-brand-cream/85 border-b border-brand-pink/30">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <BrandMark />
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={cn('font-semibold text-brand-ink hover:text-brand-rose', isActive(l.href) && 'text-brand-rose')}>
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
        <nav className="md:hidden border-t border-brand-pink/30 px-4 pb-4 pt-2 flex flex-col text-[15px]">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-2.5 font-semibold text-brand-ink">
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

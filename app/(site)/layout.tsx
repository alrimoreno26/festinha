import Navbar from '@/components/landing/Navbar'
import type { ReactNode } from 'react'

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1">{children}</div>
      <footer className="py-10 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Festinhas Criativa Papelaria · Feito com amor
      </footer>
    </div>
  )
}

import { Card } from '@/components/ui'
import Link from 'next/link'
import type { ReactNode } from 'react'

/** Moldura das telas públicas de autenticação (login, esqueci/redefinir senha). */
export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <Link href="/" className="flex items-center gap-3 mb-6">
          <img src="/logo-festinhas.png" alt="" className="h-12 w-12 object-contain" />
          <div>
            <p className="text-xl font-bold text-brand-coral leading-tight">Festinhas</p>
            <p className="text-sm text-brand-teal">Área do Cliente</p>
          </div>
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">{title}</h1>
        {description && <p className="text-sm text-gray-600 mb-6">{description}</p>}
        {children}
        {footer && <div className="mt-6 flex flex-col items-center gap-2 text-sm">{footer}</div>}
      </Card>
    </main>
  )
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
      {children}
    </p>
  )
}

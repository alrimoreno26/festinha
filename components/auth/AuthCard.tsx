import { Card } from '@/components/ui'
import { BrandMark } from '@/components/brand/Decor'
import type { ReactNode } from 'react'

/** Moldura das telas públicas de autenticação (login, esqueci/redefinir senha). */
export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 confetti">
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <div className="mb-6">
          <BrandMark subtitle="Área do Cliente" />
        </div>
        <h1 className="text-2xl font-bold text-brand-ink mb-1">{title}</h1>
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

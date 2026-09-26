import { RequireRole } from '@/components/auth/RequireRole'
import { ContaShell } from '@/components/conta/ContaShell'
import type { ReactNode } from 'react'

export default function ContaLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="customer">
      <ContaShell>{children}</ContaShell>
    </RequireRole>
  )
}

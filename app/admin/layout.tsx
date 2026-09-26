import { AdminShell } from '@/components/admin/AdminShell'
import { RequireRole } from '@/components/auth/RequireRole'
import type { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="admin">
      <AdminShell>{children}</AdminShell>
    </RequireRole>
  )
}

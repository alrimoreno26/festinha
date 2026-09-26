'use client'

import { DevToolbar } from '@/components/dev/DevToolbar'
import { ToastProvider } from '@/components/ui'
import { devToolsEnabled, subscribeDevSettings } from '@/lib/mock/dev-settings'
import { subscribeDb } from '@/lib/mock/store'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
          mutations: { retry: false },
        },
      }),
  )

  // Mock: qualquer alteração no "banco" ou na DevToolbar recarrega os dados da tela.
  useEffect(() => {
    const refresh = () => client.invalidateQueries()
    const unsubDb = subscribeDb(refresh)
    const unsubDev = subscribeDevSettings(refresh)
    return () => {
      unsubDb()
      unsubDev()
    }
  }, [client])

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        {children}
        {devToolsEnabled && <DevToolbar />}
      </ToastProvider>
    </QueryClientProvider>
  )
}

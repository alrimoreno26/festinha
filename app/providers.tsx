'use client'

import { DevToolbar } from '@/components/dev/DevToolbar'
import { ToastProvider } from '@/components/ui'
import { devToolsEnabled, subscribeDevSettings } from '@/lib/dev/settings'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const qc: QueryClient = new QueryClient({
      // Toda alteração bem-sucedida recarrega os dados visíveis: as telas ficam sempre em dia
      // sem cada uma precisar saber quais consultas a mudança afeta.
      mutationCache: new MutationCache({ onSuccess: () => qc.invalidateQueries() }),
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
        mutations: { retry: false },
      },
    })
    return qc
  })

  // Mudanças na DevToolbar (ex.: simular erro de rede) recarregam a tela para mostrar o efeito.
  useEffect(() => {
    const unsubscribe = subscribeDevSettings(() => client.invalidateQueries())
    return () => {
      unsubscribe()
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

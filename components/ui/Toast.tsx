'use client'

import { cn } from '@/lib/cn'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  tone: ToastTone
  message: ReactNode
}

interface ToastApi {
  success: (message: ReactNode) => void
  error: (message: ReactNode) => void
  info: (message: ReactNode) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const icons = { success: CheckCircle2, error: XCircle, info: Info }
const toneClasses = {
  success: 'text-emerald-600',
  error: 'text-red-600',
  info: 'text-brand-teal',
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const push = useCallback(
    (tone: ToastTone, message: ReactNode) => {
      const id = nextId++
      setToasts((t) => [...t.slice(-3), { id, tone, message }])
      setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 4000)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed z-[70] top-4 sm:top-auto sm:bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-96" aria-live="polite">
        {toasts.map((t) => {
          const Icon = icons[t.tone]
          return (
            <div key={t.id} className="animate-toast-in flex items-start gap-3 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-black/5">
              <Icon size={20} className={cn('shrink-0 mt-0.5', toneClasses[t.tone])} />
              <div className="flex-1 text-sm text-gray-800">{t.message}</div>
              <button onClick={() => dismiss(t.id)} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return ctx
}

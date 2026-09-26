'use client'

import { errorMessage } from '@/lib/services/errors'
import type { UseQueryResult } from '@tanstack/react-query'
import { AlertTriangle, Inbox, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { PageLoader } from './Spinner'

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div className="mb-4 rounded-full bg-brand-blush p-4 text-brand-coral">
        <Icon size={28} />
      </div>
      <p className="font-semibold text-gray-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6" role="alert">
      <div className="mb-4 rounded-full bg-red-50 p-4 text-red-600">
        <AlertTriangle size={28} />
      </div>
      <p className="font-semibold text-gray-900">Não foi possível carregar</p>
      <p className="mt-1 max-w-sm text-sm text-gray-600">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

interface QueryStateProps<T> {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
  loading?: ReactNode
  /** Mostrado quando `isEmpty(data)` é verdadeiro. */
  empty?: ReactNode
  isEmpty?: (data: T) => boolean
}

/** Renderiza carregando / erro / vazio / dados de um useQuery de forma consistente. */
export function QueryState<T>({ query, children, loading, empty, isEmpty }: QueryStateProps<T>) {
  if (query.isPending) return <>{loading ?? <PageLoader />}</>
  // Se um refetch em segundo plano falhar, continua mostrando os dados que já temos.
  if (query.isError && query.data === undefined) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const data = query.data as T
  const emptyCheck = isEmpty ?? ((d: T) => Array.isArray(d) && d.length === 0)
  if (empty && emptyCheck(data)) return <>{empty}</>
  return <>{children(data)}</>
}

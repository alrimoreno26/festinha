'use client'

import { authService, qk } from '@/lib/services'
import { useQuery } from '@tanstack/react-query'

export function useSession() {
  const query = useQuery({ queryKey: qk.session, queryFn: authService.getSession, staleTime: Infinity })
  return {
    session: query.data ?? null,
    user: query.data?.user ?? null,
    isLoading: query.isPending,
    refetch: query.refetch,
  }
}

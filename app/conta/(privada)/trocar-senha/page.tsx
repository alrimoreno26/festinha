'use client'

import { Button, Card, Field, Input, useToast } from '@/components/ui'
import { useSession } from '@/lib/hooks/useSession'
import { authService, errorMessage, qk, ServiceError } from '@/lib/services'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

export default function TrocarSenhaPage() {
  const { user } = useSession()
  const router = useRouter()
  const toast = useToast()
  const queryClient = useQueryClient()
  const firstAccess = !!user?.mustChangePassword
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mismatch, setMismatch] = useState(false)

  const change = useMutation({
    mutationFn: () => authService.changePassword(firstAccess ? null : current, next),
    onSuccess: () => {
      // Atualiza a sessão antes de navegar; senão o RequireRole ainda vê a senha temporária e volta para cá.
      if (user) queryClient.setQueryData(qk.session, { user: { ...user, mustChangePassword: false } })
      toast.success('Senha alterada com sucesso!')
      router.replace('/conta')
    },
  })

  const details = change.error instanceof ServiceError ? change.error.details : undefined

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const differs = next !== confirm
    setMismatch(differs)
    if (!differs) change.mutate()
  }

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">{firstAccess ? 'Crie sua senha' : 'Trocar senha'}</h1>
        <p className="text-sm text-gray-600 mb-6">
          {firstAccess
            ? 'Este é seu primeiro acesso. Troque a senha temporária por uma que só você saiba.'
            : 'Informe sua senha atual e escolha uma nova.'}
        </p>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {!firstAccess && (
            <Field label="Senha atual" error={details?.currentPassword ? errorMessage(change.error) : null}>
              <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
          )}
          <Field label="Nova senha" hint="Mínimo de 8 caracteres." error={details?.password ? errorMessage(change.error) : null}>
            <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="Confirme a nova senha" error={mismatch ? 'As senhas não coincidem.' : null}>
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {change.isError && !details && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {errorMessage(change.error)}
            </p>
          )}
          <Button type="submit" className="w-full" loading={change.isPending} disabled={!next || !confirm}>
            Salvar senha
          </Button>
        </form>
      </Card>
    </div>
  )
}

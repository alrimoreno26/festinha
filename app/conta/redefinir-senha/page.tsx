'use client'

import { AuthCard, FormError } from '@/components/auth/AuthCard'
import { Button, ButtonLink, Field, Input, PageLoader } from '@/components/ui'
import { authService, errorMessage, ServiceError } from '@/lib/services'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState, type FormEvent } from 'react'

function RedefinirForm() {
  const token = useSearchParams().get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const reset = useMutation({ mutationFn: () => authService.resetPassword(token, password) })
  const passwordError = reset.error instanceof ServiceError && reset.error.details?.password ? errorMessage(reset.error) : null

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const differs = password !== confirm
    setMismatch(differs)
    if (!differs) reset.mutate()
  }

  if (reset.isSuccess)
    return (
      <AuthCard title="Senha alterada!">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-full bg-emerald-50 p-4 text-emerald-600">
            <CheckCircle2 size={28} />
          </div>
          <p className="text-sm text-gray-600">Agora é só entrar com sua nova senha.</p>
          <ButtonLink href="/conta/login" className="mt-6 w-full">
            Ir para o login
          </ButtonLink>
        </div>
      </AuthCard>
    )

  return (
    <AuthCard
      title="Criar nova senha"
      description="Escolha uma senha com pelo menos 8 caracteres."
      footer={
        <Link href="/conta/esqueci-senha" className="text-brand-teal hover:underline">
          Pedir um novo link
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Nova senha" error={passwordError}>
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirme a nova senha" error={mismatch ? 'As senhas não coincidem.' : null}>
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {reset.isError && !passwordError && <FormError>{errorMessage(reset.error)}</FormError>}
        <Button type="submit" className="w-full" loading={reset.isPending} disabled={!password || !confirm}>
          Salvar nova senha
        </Button>
      </form>
    </AuthCard>
  )
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RedefinirForm />
    </Suspense>
  )
}

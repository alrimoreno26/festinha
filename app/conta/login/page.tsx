'use client'

import { AuthCard, FormError } from '@/components/auth/AuthCard'
import { Button, Field, Input, PageLoader } from '@/components/ui'
import { useSession } from '@/lib/hooks/useSession'
import { authService, errorMessage, qk } from '@/lib/services'
import type { User } from '@/lib/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { hardNavigate, homeAfterLogin } from '@/lib/navigation'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState, type FormEvent } from 'react'

function LoginForm() {
  const params = useSearchParams()
  const queryClient = useQueryClient()
  const { user, isLoading } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Recarga completa: descarta redirecionamentos do middleware guardados em cache de antes do login.
  const goHome = (u: User) => hardNavigate(homeAfterLogin(u, params.get('next')))

  // Já logado: não mostra o formulário.
  useEffect(() => {
    if (user) goHome(user)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const login = useMutation({
    mutationFn: () => authService.login(email, password),
    onSuccess: (session) => queryClient.setQueryData(qk.session, session),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate()
  }

  if (isLoading || user) return <PageLoader />

  return (
    <AuthCard
      title="Entrar"
      description="Use o email da compra e a senha que enviamos para você."
      footer={
        <>
          <Link href="/conta/esqueci-senha" className="text-brand-teal hover:underline">
            Esqueci minha senha
          </Link>
          <Link href="/pacotes" className="text-gray-500 hover:underline">
            Ainda não comprou? Ver kits
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
        </Field>
        <Field label="Senha">
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {login.isError && <FormError>{errorMessage(login.error)}</FormError>}
        <Button type="submit" className="w-full" loading={login.isPending} disabled={!email || !password}>
          Entrar
        </Button>
      </form>
    </AuthCard>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginForm />
    </Suspense>
  )
}

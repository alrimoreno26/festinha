'use client'

import { AuthCard, FormError } from '@/components/auth/AuthCard'
import { Button, Field, Input } from '@/components/ui'
import { authService, errorMessage } from '@/lib/services'
import { useMutation } from '@tanstack/react-query'
import { MailCheck } from 'lucide-react'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const request = useMutation({ mutationFn: () => authService.requestPasswordReset(email) })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    request.mutate()
  }

  const backToLogin = (
    <Link href="/conta/login" className="text-brand-teal hover:underline">
      Voltar para o login
    </Link>
  )

  if (request.isSuccess)
    return (
      <AuthCard title="Verifique seu email" footer={backToLogin}>
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-full bg-emerald-50 p-4 text-emerald-600">
            <MailCheck size={28} />
          </div>
          <p className="text-sm text-gray-600">
            Se existir uma conta com <strong>{email}</strong>, enviamos um link para criar uma nova senha. O link vale por 1 hora.
          </p>
          <p className="mt-3 text-xs text-gray-500">Não chegou? Veja a caixa de spam ou tente de novo em alguns minutos.</p>
        </div>
      </AuthCard>
    )

  return (
    <AuthCard title="Esqueci minha senha" description="Informe o email da sua compra e enviaremos um link para criar uma nova senha." footer={backToLogin}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
        </Field>
        {request.isError && <FormError>{errorMessage(request.error)}</FormError>}
        <Button type="submit" className="w-full" loading={request.isPending} disabled={!email.includes('@')}>
          Enviar link
        </Button>
      </form>
    </AuthCard>
  )
}

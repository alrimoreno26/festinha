'use client'

import { Button, ButtonLink, Card, Field, Input, PageHeader, useToast } from '@/components/ui'
import { formatPhoneBR } from '@/lib/format'
import { useSession } from '@/lib/hooks/useSession'
import { authService, errorMessage, qk, ServiceError } from '@/lib/services'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

export default function PerfilPage() {
  const { user } = useSession()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (user) {
      setName(user.name)
      setPhone(formatPhoneBR(user.phone ?? ''))
    }
  }, [user])

  const save = useMutation({
    mutationFn: () => authService.updateProfile({ name, phone }),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.session, { user: updated })
      toast.success('Dados atualizados.')
    },
  })
  const details = save.error instanceof ServiceError ? save.error.details : undefined
  const dirty = !!user && (name !== user.name || phone !== formatPhoneBR(user.phone ?? ''))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <>
      <PageHeader title="Minha conta" />
      <div className="grid gap-6 md:grid-cols-[1fr_300px] md:items-start">
        <Card className="p-6">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <h2 className="font-semibold text-gray-900">Seus dados</h2>
            <Field label="Nome" error={details?.name ? errorMessage(save.error) : null}>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label="Email" hint="É o email das suas compras. Para trocar, fale com a gente.">
              <Input value={user?.email ?? ''} disabled />
            </Field>
            <Field label="WhatsApp">
              <Input type="tel" value={phone} onChange={(e) => setPhone(formatPhoneBR(e.target.value))} autoComplete="tel" />
            </Field>
            {save.isError && !details && <p className="text-sm text-red-600">{errorMessage(save.error)}</p>}
            <Button type="submit" loading={save.isPending} disabled={!dirty}>
              Salvar alterações
            </Button>
          </form>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <KeyRound size={18} className="text-brand-teal" /> Senha
          </div>
          <p className="mt-1 text-sm text-gray-600">Troque sua senha sempre que quiser.</p>
          <ButtonLink href="/conta/trocar-senha" variant="outline" size="sm" className="mt-4">
            Trocar senha
          </ButtonLink>
        </Card>
      </div>
    </>
  )
}

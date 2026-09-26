'use client'

import { PackageCover } from '@/components/catalog/PackageCard'
import { Button, ButtonLink, Card, EmptyState, ErrorState, Field, Input, PageLoader } from '@/components/ui'
import { cn } from '@/lib/cn'
import { accessLabel, formatBRL, formatPhoneBR } from '@/lib/format'
import { useSession } from '@/lib/hooks/useSession'
import { checkoutService, errorMessage, packagesService, qk, ServiceError } from '@/lib/services'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronLeft, Lock, SearchX } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'

export default function CheckoutPage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  const { user } = useSession()
  const pkgQuery = useQuery({
    queryKey: qk.publicPackage(params.slug),
    queryFn: () => packagesService.getPublicBySlug(params.slug),
  })

  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [accepted, setAccepted] = useState(false)
  const [touchedTerms, setTouchedTerms] = useState(false)

  // Cliente logado: preenche com os dados da conta.
  useEffect(() => {
    if (user?.role === 'customer')
      setForm((f) => ({ name: f.name || user.name, email: f.email || user.email, phone: f.phone || formatPhoneBR(user.phone ?? '') }))
  }, [user])

  const order = useMutation({
    mutationFn: () => checkoutService.createOrder({ packageSlug: params.slug, ...form }),
    onSuccess: ({ checkoutUrl }) => router.push(checkoutUrl),
  })

  const fieldErrors = order.error instanceof ServiceError && order.error.code === 'VALIDATION' ? order.error.details ?? {} : {}
  const generalError = order.isError && !Object.keys(fieldErrors).length ? errorMessage(order.error) : null

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setTouchedTerms(true)
    if (accepted) order.mutate()
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: key === 'phone' ? formatPhoneBR(e.target.value) : e.target.value }))

  if (pkgQuery.isPending) return <PageLoader />
  if (pkgQuery.isError) {
    const notFound = pkgQuery.error instanceof ServiceError && pkgQuery.error.code === 'NOT_FOUND'
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <Card>
          {notFound ? (
            <EmptyState icon={SearchX} title="Kit indisponível" description="Este kit não está mais à venda." action={<ButtonLink href="/pacotes">Ver kits</ButtonLink>} />
          ) : (
            <ErrorState error={pkgQuery.error} onRetry={() => pkgQuery.refetch()} />
          )}
        </Card>
      </main>
    )
  }

  const pkg = pkgQuery.data

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <Link href={`/pacotes/${pkg.slug}`} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ChevronLeft size={16} /> Voltar ao kit
      </Link>
      <h1 className="mt-4 text-2xl md:text-3xl font-bold text-brand-cocoa">Finalizar compra</h1>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_340px] md:items-start">
        <Card className="p-6 order-2 md:order-1">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <h2 className="font-semibold text-gray-900">Seus dados</h2>
            <Field label="Nome completo" error={fieldErrors.name}>
              <Input autoComplete="name" value={form.name} onChange={set('name')} placeholder="Maria Souza" />
            </Field>
            <Field label="Email" hint="É para este email que enviaremos o acesso aos arquivos." error={fieldErrors.email}>
              <Input type="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder="voce@email.com" />
            </Field>
            <Field label="WhatsApp" hint="Só usamos para ajudar se algo der errado com seu pedido." error={fieldErrors.phone}>
              <Input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="(48) 99999-0000" />
            </Field>

            <label className={cn('flex items-start gap-3 text-sm', touchedTerms && !accepted ? 'text-red-600' : 'text-gray-700')}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-brand-coral"
              />
              <span>
                Li e aceito os{' '}
                <a href="#" className="underline">
                  termos de uso
                </a>{' '}
                e a{' '}
                <a href="#" className="underline">
                  política de privacidade
                </a>
                . Os arquivos são para uso pessoal e não podem ser revendidos.
              </span>
            </label>

            {generalError && (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {generalError}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" loading={order.isPending}>
              Ir para o pagamento
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
              <Lock size={12} /> Pagamento processado com segurança pelo Mercado Pago
            </p>
          </form>
        </Card>

        <Card className="overflow-hidden order-1 md:order-2 md:sticky md:top-24">
          <PackageCover src={pkg.coverUrl} alt={pkg.title} className="h-40 w-full" />
          <div className="p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">Resumo</p>
            <p className="mt-1 font-semibold text-gray-900">{pkg.title}</p>
            <p className="text-sm text-gray-600">
              {pkg.files.length} arquivos · {accessLabel(pkg.accessDays)}
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-4">
              <span className="text-gray-700">Total</span>
              <span className="text-xl font-bold tabular-nums">{formatBRL(pkg.priceCents)}</span>
            </div>
          </div>
        </Card>
      </div>
    </main>
  )
}

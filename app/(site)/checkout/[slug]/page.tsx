'use client'

import { PackageCover, packageSummary } from '@/components/catalog/PackageCard'
import { Button, ButtonLink, Card, EmptyState, ErrorState, Field, Input, KindBadge, PageLoader, Textarea } from '@/components/ui'
import { needsCustomization, needsName } from '@/lib/contracts'
import { cn } from '@/lib/cn'
import { formatBRL, formatPhoneBR } from '@/lib/format'
import { daysLabel, emptyDelivery, selectedOption, ShippingSection, type DeliveryState } from '@/components/checkout/ShippingSection'
import type { Customization } from '@/lib/types'
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
  const [custom, setCustom] = useState<Customization>({ childName: '', age: '', theme: '', colors: '', notes: '' })
  const [delivery, setDelivery] = useState<DeliveryState>(emptyDelivery)
  const [accepted, setAccepted] = useState(false)
  const [touchedTerms, setTouchedTerms] = useState(false)

  // Cliente logado: preenche com os dados da conta.
  useEffect(() => {
    if (user?.role === 'customer')
      setForm((f) => ({ name: f.name || user.name, email: f.email || user.email, phone: f.phone || formatPhoneBR(user.phone ?? '') }))
  }, [user])

  const order = useMutation({
    mutationFn: () => {
      const pkg = pkgQuery.data!
      return checkoutService.createOrder({
        packageSlug: params.slug,
        ...form,
        ...(needsCustomization(pkg) && { customization: custom }),
        ...(pkg.kind === 'printed' && {
          deliveryMethod: delivery.method ?? undefined,
          ...(delivery.method === 'shipping' && { shippingAddress: delivery.address, shippingServiceId: delivery.serviceId ?? undefined }),
        }),
      })
    },
    // Mercado Pago: página externa (navegação completa). Simulador: rota interna.
    onSuccess: ({ checkoutUrl }) => (/^https?:\/\//.test(checkoutUrl) ? window.location.assign(checkoutUrl) : router.push(checkoutUrl)),
  })

  const shippingChoice = selectedOption(delivery)
  const fieldErrors = order.error instanceof ServiceError && order.error.code === 'VALIDATION' ? order.error.details ?? {} : {}
  const generalError = order.isError && !Object.keys(fieldErrors).length ? errorMessage(order.error) : null

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setTouchedTerms(true)
    if (accepted) order.mutate()
  }

  const setC = (key: keyof Customization) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setCustom((c) => ({ ...c, [key]: e.target.value }))

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
      <h1 className="mt-4 text-2xl md:text-3xl font-bold text-brand-ink">Finalizar compra</h1>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_340px] md:items-start">
        <Card className="p-6 order-2 md:order-1">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <h2 className="font-semibold text-gray-900">Seus dados</h2>
            <Field label="Nome completo" error={fieldErrors.name}>
              <Input autoComplete="name" value={form.name} onChange={set('name')} placeholder="Maria Souza" />
            </Field>
            <Field
              label="Email"
              hint={pkg.kind === 'digital' ? 'É para este email que enviaremos o acesso aos arquivos.' : 'Enviaremos a confirmação e as novidades do pedido para este email.'}
              error={fieldErrors.email}
            >
              <Input type="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder="voce@email.com" />
            </Field>
            <Field
              label="WhatsApp"
              hint={pkg.kind === 'digital' ? 'Só usamos para ajudar se algo der errado com seu pedido.' : 'Usamos para combinar os detalhes da personalização e da entrega.'}
              error={fieldErrors.phone}
            >
              <Input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="(48) 99999-0000" />
            </Field>

            {needsCustomization(pkg) && (
              <div className="space-y-4 border-t border-brand-pink/30 pt-5">
                <div>
                  <h2 className="font-semibold text-gray-900">Personalização</h2>
                  <p className="text-sm text-gray-500">
                    Conte como você quer o seu kit. Se quiser completar ou ajustar algum detalhe, você tem até 48 horas pelo WhatsApp. 💕
                  </p>
                </div>
                {needsName(pkg) && (
                  <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                    <Field label="Nome na arte" hint="Ex.: nome do aniversariante." error={fieldErrors.childName}>
                      <Input value={custom.childName} onChange={setC('childName')} placeholder="Miguel" maxLength={120} />
                    </Field>
                    <Field label="Idade" error={fieldErrors.age}>
                      <Input value={custom.age} onChange={setC('age')} placeholder="2 anos" maxLength={40} />
                    </Field>
                  </div>
                )}
                <Field label="Tema da festa" error={fieldErrors.theme}>
                  <Input value={custom.theme} onChange={setC('theme')} placeholder="Fazendinha, Safári, Unicórnio…" maxLength={200} />
                </Field>
                <Field label="Cores (opcional)" error={fieldErrors.colors}>
                  <Input value={custom.colors} onChange={setC('colors')} placeholder="Azul e amarelo" maxLength={200} />
                </Field>
                <Field label="Observações (opcional)" hint="Data da festa, frases, referências…" error={fieldErrors.notes}>
                  <Textarea value={custom.notes} onChange={setC('notes')} rows={3} maxLength={2000} />
                </Field>
              </div>
            )}

            {pkg.kind === 'printed' && (
              <ShippingSection packageSlug={pkg.slug} shippable={pkg.shippable} value={delivery} onChange={setDelivery} errors={fieldErrors} />
            )}

            <label className={cn('flex items-start gap-3 text-sm', touchedTerms && !accepted ? 'text-red-600' : 'text-gray-700')}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-brand-rose"
              />
              <span>
                Li e aceito as{' '}
                <Link href="/informacoes#condicoes" target="_blank" className="underline">
                  condições do pedido
                </Link>{' '}
                e a{' '}
                <Link href="/informacoes#cancelamento" target="_blank" className="underline">
                  política de cancelamento
                </Link>
                .{' '}
                {pkg.kind === 'digital'
                  ? 'Os arquivos são para uso pessoal e não podem ser revendidos.'
                  : 'Alterações na arte podem ser pedidas em até 48 horas após a aprovação.'}
              </span>
            </label>

            {generalError && (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {generalError}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" loading={order.isPending || order.isSuccess}>
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-gray-500">Resumo</p>
              <KindBadge kind={pkg.kind} />
            </div>
            <p className="mt-1 font-semibold text-gray-900">{pkg.title}</p>
            <p className="text-sm text-gray-600">{packageSummary(pkg)}</p>
            <dl className="mt-4 space-y-1.5 border-t border-black/5 pt-4 text-sm">
              {pkg.kind === 'printed' && (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-600">Kit</dt>
                    <dd className="tabular-nums">{formatBRL(pkg.priceCents)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-600">{shippingChoice ? `Frete (${daysLabel(shippingChoice)})` : 'Frete'}</dt>
                    <dd className="tabular-nums">
                      {delivery.method === 'pickup' ? 'Grátis (retirada)' : shippingChoice ? formatBRL(shippingChoice.priceCents) : 'Informe o CEP'}
                    </dd>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between gap-3 pt-1">
                <dt className="text-base text-gray-700">Total</dt>
                <dd className="text-xl font-bold tabular-nums">{formatBRL(pkg.priceCents + (shippingChoice?.priceCents ?? 0))}</dd>
              </div>
            </dl>
          </div>
        </Card>
      </div>
    </main>
  )
}

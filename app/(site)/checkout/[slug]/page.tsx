'use client'

// Checkout em etapas: Seus dados → Personalização (se o kit pede) → Entrega (impressos) → Revisão e pagamento.
// Cada etapa é validada antes de avançar (as mesmas regras do servidor); se o servidor ainda assim recusar
// algum campo, voltamos para a etapa desse campo.

import { PackageCover, packageSummary } from '@/components/catalog/PackageCard'
import { daysLabel, emptyDelivery, selectedOption, ShippingSection, type DeliveryState } from '@/components/checkout/ShippingSection'
import { Button, ButtonLink, Card, EmptyState, ErrorState, Field, Input, KindBadge, PageLoader, Textarea } from '@/components/ui'
import { addressLines } from '@/lib/address'
import { cn } from '@/lib/cn'
import { needsCustomization, needsName, type PublicPackage } from '@/lib/contracts'
import { formatBRL, formatPhoneBR } from '@/lib/format'
import { useSession } from '@/lib/hooks/useSession'
import { DELIVERY_LABEL } from '@/lib/labels'
import { checkoutService, errorMessage, packagesService, qk, ServiceError } from '@/lib/services'
import type { Customization } from '@/lib/types'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Lock, Pencil, SearchX } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

type StepId = 'dados' | 'personalizacao' | 'entrega' | 'revisao'

const STEP_LABEL: Record<StepId, string> = {
  dados: 'Seus dados',
  personalizacao: 'Personalização',
  entrega: 'Entrega',
  revisao: 'Pagamento',
}

/** Em qual etapa cada campo (dos erros do servidor) fica. */
const FIELD_STEP: Record<string, StepId> = {
  name: 'dados',
  email: 'dados',
  phone: 'dados',
  childName: 'personalizacao',
  age: 'personalizacao',
  theme: 'personalizacao',
  colors: 'personalizacao',
  notes: 'personalizacao',
  deliveryMethod: 'entrega',
  postalCode: 'entrega',
  street: 'entrega',
  number: 'entrega',
  complement: 'entrega',
  district: 'entrega',
  city: 'entrega',
  state: 'entrega',
  shippingServiceId: 'entrega',
}

const stepsFor = (pkg: PublicPackage): StepId[] => [
  'dados',
  ...(needsCustomization(pkg) ? (['personalizacao'] as const) : []),
  ...(pkg.kind === 'printed' ? (['entrega'] as const) : []),
  'revisao',
]

type Form = { name: string; email: string; phone: string }

/** Mesmas regras do servidor, para avisar antes de avançar. */
function validateStep(step: StepId, pkg: PublicPackage, form: Form, custom: Customization, delivery: DeliveryState) {
  const e: Record<string, string> = {}
  if (step === 'dados') {
    if (form.name.trim().length < 3) e.name = 'Informe seu nome completo.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Informe um email válido.'
    if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'Informe um WhatsApp com DDD.'
  }
  if (step === 'personalizacao') {
    if (needsName(pkg) && !custom.childName.trim()) e.childName = 'Informe o nome que vai na arte.'
    if (!custom.theme.trim()) e.theme = 'Informe o tema da festa.'
  }
  if (step === 'entrega') {
    if (!delivery.method) e.deliveryMethod = 'Escolha retirada ou envio.'
    if (delivery.method === 'shipping') {
      const a = delivery.address
      if (a.postalCode.replace(/\D/g, '').length !== 8) e.postalCode = 'Informe um CEP com 8 dígitos.'
      else if (!delivery.serviceId) e.shippingServiceId = 'Escolha uma opção de envio.'
      if (delivery.options.length) {
        if (!a.street.trim()) e.street = 'Informe a rua.'
        if (!a.number.trim()) e.number = 'Informe o número (ou "s/n").'
        if (!a.district.trim()) e.district = 'Informe o bairro.'
        if (!a.city.trim()) e.city = 'Informe a cidade.'
        if (!/^[A-Za-z]{2}$/.test(a.state.trim())) e.state = 'UF com 2 letras.'
      }
    }
  }
  return e
}

function Stepper({ steps, current, onGo }: { steps: StepId[]; current: number; onGo: (i: number) => void }) {
  return (
    <ol className="flex items-center gap-1 sm:gap-2" aria-label="Etapas da compra">
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s} className="flex flex-1 items-center gap-1 sm:gap-2 last:flex-none">
            <button
              type="button"
              onClick={() => done && onGo(i)}
              disabled={!done}
              aria-current={active ? 'step' : undefined}
              className={cn('flex items-center gap-2 rounded-full text-left', done && 'cursor-pointer')}
            >
              <span
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold transition-colors',
                  active ? 'bg-brand-rose text-white' : done ? 'bg-brand-mint text-brand-ink' : 'bg-gray-100 text-gray-400',
                )}
              >
                {done ? <Check size={16} /> : i + 1}
              </span>
              <span className={cn('hidden text-sm sm:block', active ? 'font-semibold text-brand-ink' : done ? 'text-gray-700' : 'text-gray-400')}>
                {STEP_LABEL[s]}
              </span>
            </button>
            {i < steps.length - 1 && <span aria-hidden className={cn('h-0.5 flex-1 rounded-full', done ? 'bg-brand-mint' : 'bg-gray-200')} />}
          </li>
        )
      })}
    </ol>
  )
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-grape hover:underline">
          <Pencil size={12} /> Editar
        </button>
      </div>
      <div className="mt-1.5 space-y-0.5 text-sm text-gray-800">{children}</div>
    </div>
  )
}

export default function CheckoutPage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  const { user } = useSession()
  const pkgQuery = useQuery({
    queryKey: qk.publicPackage(params.slug),
    queryFn: () => packagesService.getPublicBySlug(params.slug),
  })

  const [form, setForm] = useState<Form>({ name: '', email: '', phone: '' })
  const [custom, setCustom] = useState<Customization>({ childName: '', age: '', theme: '', colors: '', notes: '' })
  const [delivery, setDelivery] = useState<DeliveryState>(emptyDelivery)
  const [accepted, setAccepted] = useState(false)
  const [touchedTerms, setTouchedTerms] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const topRef = useRef<HTMLDivElement>(null)

  // Cliente logado: preenche com os dados da conta.
  useEffect(() => {
    if (user?.role === 'customer')
      setForm((f) => ({ name: f.name || user.name, email: f.email || user.email, phone: f.phone || formatPhoneBR(user.phone ?? '') }))
  }, [user])

  const steps = pkgQuery.data ? stepsFor(pkgQuery.data) : (['dados', 'revisao'] as StepId[])
  const step = steps[Math.min(stepIndex, steps.length - 1)]

  const goTo = (i: number) => {
    setLocalErrors({})
    setStepIndex(i)
    // Mantém a etapa nova à vista sem precisar rolar.
    requestAnimationFrame(() => {
      const top = topRef.current?.getBoundingClientRect().top ?? 0
      if (top < 0) topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

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
    // Campo recusado pelo servidor: volta para a etapa dele.
    onError: (err) => {
      if (!(err instanceof ServiceError) || err.code !== 'VALIDATION') return
      const first = steps.findIndex((s) => Object.keys(err.details ?? {}).some((k) => FIELD_STEP[k] === s))
      if (first >= 0 && first !== stepIndex) goTo(first)
    },
  })

  const serverErrors = order.error instanceof ServiceError && order.error.code === 'VALIDATION' ? order.error.details ?? {} : {}
  const fieldErrors = { ...serverErrors, ...localErrors }
  const generalError = order.isError && !Object.keys(serverErrors).length ? errorMessage(order.error) : null
  const shippingChoice = selectedOption(delivery)

  const next = (e?: FormEvent) => {
    e?.preventDefault()
    const pkg = pkgQuery.data!
    if (step === 'revisao') {
      setTouchedTerms(true)
      if (accepted) order.mutate()
      return
    }
    const errors = validateStep(step, pkg, form, custom, delivery)
    setLocalErrors(errors)
    if (!Object.keys(errors).length) goTo(stepIndex + 1)
  }

  const setC = (key: keyof Customization) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setCustom((c) => ({ ...c, [key]: e.target.value }))

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
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
  const total = pkg.priceCents + (shippingChoice?.priceCents ?? 0)
  const editStep = (s: StepId) => () => goTo(steps.indexOf(s))

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 md:py-10">
      <div ref={topRef} className="scroll-mt-24" />
      <div className="flex items-center justify-between gap-3">
        <Link href={`/pacotes/${pkg.slug}`} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ChevronLeft size={16} /> Voltar ao kit
        </Link>
        <p className="text-xs text-gray-500 sm:hidden">
          Etapa {stepIndex + 1} de {steps.length} · <span className="font-semibold text-brand-ink">{STEP_LABEL[step]}</span>
        </p>
      </div>

      {/* Celular: resumo compacto no lugar do cartão lateral */}
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-brand-pink/25 md:hidden">
        <PackageCover src={pkg.coverUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{pkg.title}</p>
          <p className="text-xs text-gray-500">{shippingChoice ? `Inclui frete de ${formatBRL(shippingChoice.priceCents)}` : packageSummary(pkg)}</p>
        </div>
        <p className="font-display text-lg font-bold tabular-nums text-brand-rose">{formatBRL(total)}</p>
      </div>

      <div className="mt-4 grid gap-6 md:mt-6 md:grid-cols-[1fr_320px] md:items-start">
        <Card className="p-5 sm:p-6">
          <Stepper steps={steps} current={stepIndex} onGo={goTo} />

          <form onSubmit={next} className="mt-6 space-y-4" noValidate>
            <h1 className="text-xl font-bold text-brand-ink sm:text-2xl">{step === 'revisao' ? 'Revise e pague' : STEP_LABEL[step]}</h1>

            {step === 'dados' && (
              <>
                <Field label="Nome completo" error={fieldErrors.name}>
                  <Input autoComplete="name" value={form.name} onChange={set('name')} placeholder="Maria Souza" autoFocus />
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
                  hint={pkg.kind === 'digital' ? 'Só usamos para ajudar se algo der errado com seu pedido.' : 'Usamos para combinar os detalhes da personalização.'}
                  error={fieldErrors.phone}
                >
                  <Input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="(48) 99999-0000" />
                </Field>
              </>
            )}

            {step === 'personalizacao' && (
              <>
                <p className="text-sm text-gray-500">
                  Conte como você quer o seu kit. Se quiser completar ou ajustar algum detalhe, você tem até 48 horas pelo WhatsApp. 💕
                </p>
                {needsName(pkg) && (
                  <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                    <Field label="Nome na arte" hint="Ex.: nome do aniversariante." error={fieldErrors.childName}>
                      <Input value={custom.childName} onChange={setC('childName')} placeholder="Miguel" maxLength={120} autoFocus />
                    </Field>
                    <Field label="Idade" error={fieldErrors.age}>
                      <Input value={custom.age} onChange={setC('age')} placeholder="2 anos" maxLength={40} />
                    </Field>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Tema da festa" error={fieldErrors.theme}>
                    <Input value={custom.theme} onChange={setC('theme')} placeholder="Fazendinha, Safári…" maxLength={200} autoFocus={!needsName(pkg)} />
                  </Field>
                  <Field label="Cores (opcional)" error={fieldErrors.colors}>
                    <Input value={custom.colors} onChange={setC('colors')} placeholder="Azul e amarelo" maxLength={200} />
                  </Field>
                </div>
                <Field label="Observações (opcional)" hint="Data da festa, frases, referências…" error={fieldErrors.notes}>
                  <Textarea value={custom.notes} onChange={setC('notes')} rows={2} maxLength={2000} />
                </Field>
              </>
            )}

            {step === 'entrega' && (
              <ShippingSection packageSlug={pkg.slug} shippable={pkg.shippable} value={delivery} onChange={setDelivery} errors={fieldErrors} />
            )}

            {step === 'revisao' && (
              <>
                <div className="grid gap-3">
                  <ReviewBlock title="Seus dados" onEdit={editStep('dados')}>
                    <p className="font-medium">{form.name}</p>
                    <p className="text-gray-600">
                      {form.email} · {form.phone}
                    </p>
                  </ReviewBlock>
                  {needsCustomization(pkg) && (
                    <ReviewBlock title="Personalização" onEdit={editStep('personalizacao')}>
                      {needsName(pkg) && (
                        <p>
                          <span className="font-medium">{custom.childName}</span>
                          {custom.age && ` · ${custom.age}`}
                        </p>
                      )}
                      <p className="text-gray-600">
                        Tema: {custom.theme}
                        {custom.colors && ` · Cores: ${custom.colors}`}
                      </p>
                      {custom.notes && <p className="truncate text-gray-500">{custom.notes}</p>}
                    </ReviewBlock>
                  )}
                  {pkg.kind === 'printed' && delivery.method && (
                    <ReviewBlock title="Entrega" onEdit={editStep('entrega')}>
                      <p className="font-medium">
                        {shippingChoice
                          ? `${[shippingChoice.company, shippingChoice.service].filter(Boolean).join(' · ')} · ${formatBRL(shippingChoice.priceCents)}`
                          : DELIVERY_LABEL[delivery.method]}
                      </p>
                      {shippingChoice && <p className="text-gray-600">{daysLabel(shippingChoice)} após o envio</p>}
                      {delivery.method === 'shipping' &&
                        addressLines({ ...delivery.address, postalCode: delivery.address.postalCode.replace(/\D/g, '') }).map((l) => (
                          <p key={l} className="text-gray-600">
                            {l}
                          </p>
                        ))}
                      {delivery.method === 'pickup' && <p className="text-gray-600">Grátis. Combinamos o horário pelo WhatsApp.</p>}
                    </ReviewBlock>
                  )}
                </div>

                <label className={cn('flex items-start gap-3 text-sm', touchedTerms && !accepted ? 'text-red-600' : 'text-gray-700')}>
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded accent-brand-rose"
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
              </>
            )}

            {generalError && (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {generalError}
              </p>
            )}

            <div className="flex items-center gap-3 border-t border-black/5 pt-4">
              {stepIndex > 0 && (
                <Button variant="ghost" onClick={() => goTo(stepIndex - 1)} disabled={order.isPending || order.isSuccess}>
                  <ChevronLeft size={16} /> Voltar
                </Button>
              )}
              <Button type="submit" size="lg" className="ml-auto flex-1 sm:flex-none" loading={order.isPending || order.isSuccess}>
                {step === 'revisao' ? (
                  <>
                    <Lock size={16} /> Pagar {formatBRL(total)}
                  </>
                ) : (
                  <>
                    Continuar <ChevronRight size={16} />
                  </>
                )}
              </Button>
            </div>
            {step === 'revisao' && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-gray-500 sm:justify-end">
                <Lock size={12} /> Pix ou cartão, com segurança pelo Mercado Pago
              </p>
            )}
          </form>
        </Card>

        <Card className="hidden overflow-hidden md:sticky md:top-24 md:block">
          <PackageCover src={pkg.coverUrl} alt={pkg.title} className="h-36 w-full" />
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
                      {delivery.method === 'pickup' ? 'Grátis (retirada)' : shippingChoice ? formatBRL(shippingChoice.priceCents) : 'Na etapa Entrega'}
                    </dd>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between gap-3 pt-1">
                <dt className="text-base text-gray-700">Total</dt>
                <dd className="text-xl font-bold tabular-nums">{formatBRL(total)}</dd>
              </div>
            </dl>
          </div>
        </Card>
      </div>
    </main>
  )
}

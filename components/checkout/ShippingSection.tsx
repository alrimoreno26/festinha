'use client'

// Checkout de kit impresso: retirada no local ou envio (Melhor Envio).
// O cliente digita o CEP → buscamos o endereço (ViaCEP) e as opções de frete → ele escolhe uma.
// O valor exibido aqui é só uma prévia: o servidor recalcula o frete ao criar o pedido.

import { Field, Input, Spinner } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatBRL } from '@/lib/format'
import { errorMessage, ServiceError, shippingService } from '@/lib/services'
import type { ShippingAddress, ShippingChoice } from '@/lib/types'
import { Package, Store, Truck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export interface DeliveryState {
  method: 'pickup' | 'shipping' | null
  address: ShippingAddress
  serviceId: number | null
  options: ShippingChoice[]
}

export const emptyDelivery: DeliveryState = {
  method: null,
  address: { postalCode: '', street: '', number: '', complement: '', district: '', city: '', state: '' },
  serviceId: null,
  options: [],
}

export const selectedOption = (d: DeliveryState) => (d.method === 'shipping' ? d.options.find((o) => o.serviceId === d.serviceId) ?? null : null)

const maskCep = (v: string) => v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')

export const daysLabel = (o: Pick<ShippingChoice, 'minDays' | 'maxDays'>) =>
  o.minDays && o.minDays !== o.maxDays ? `${o.minDays} a ${o.maxDays} dias úteis` : `${o.maxDays} ${o.maxDays === 1 ? 'dia útil' : 'dias úteis'}`

/** Endereço pelo CEP (ViaCEP, público e gratuito). Falhar não impede nada: o cliente digita. */
async function lookupCep(cep: string): Promise<Partial<ShippingAddress> | null> {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(6000) })
    const data = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
    if (data.erro) return null
    return { street: data.logradouro ?? '', district: data.bairro ?? '', city: data.localidade ?? '', state: data.uf ?? '' }
  } catch {
    return null
  }
}

export function ShippingSection({
  packageSlug,
  variantId,
  shippable,
  value,
  onChange,
  errors,
}: {
  packageSlug: string
  variantId?: string | null
  shippable: boolean
  value: DeliveryState
  onChange: (next: DeliveryState | ((prev: DeliveryState) => DeliveryState)) => void
  errors: Record<string, string>
}) {
  const [quoting, setQuoting] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const lastCep = useRef('')
  const cep = value.address.postalCode.replace(/\D/g, '')

  const setAddress = (patch: Partial<ShippingAddress>) => onChange((d) => ({ ...d, address: { ...d.address, ...patch } }))

  // CEP completo: busca endereço e frete (uma vez por CEP).
  useEffect(() => {
    const quoteKey = `${cep}:${variantId ?? ''}`
    if (value.method !== 'shipping' || cep.length !== 8 || quoteKey === lastCep.current) return
    lastCep.current = quoteKey
    let cancelled = false
    setQuoting(true)
    setQuoteError(null)
    onChange((d) => ({ ...d, options: [], serviceId: null }))

    lookupCep(cep).then((found) => {
      if (cancelled || !found) return
      // Só preenche o que o cliente ainda não digitou.
      onChange((d) => ({
        ...d,
        address: {
          ...d.address,
          street: d.address.street || found.street || '',
          district: d.address.district || found.district || '',
          city: d.address.city || found.city || '',
          state: d.address.state || found.state || '',
        },
      }))
    })
    shippingService
      .quote(packageSlug, cep, variantId)
      .then(({ options }) => {
        if (cancelled) return
        // Já deixa escolhida a opção mais barata.
        onChange((d) => ({ ...d, options, serviceId: options[0]?.serviceId ?? null }))
      })
      .catch((err) => {
        if (cancelled) return
        lastCep.current = '' // permite tentar de novo
        setQuoteError(err instanceof ServiceError ? (err.details?.postalCode ?? err.message) : errorMessage(err))
      })
      .finally(() => !cancelled && setQuoting(false))
    return () => {
      cancelled = true
    }
    // onChange é estável (setState do pai).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep, value.method, packageSlug, variantId])

  const choices = [
    { value: 'pickup' as const, icon: Store, title: 'Retirar no local', desc: 'Grátis. Horário combinado pelo WhatsApp.' },
    ...(shippable ? [{ value: 'shipping' as const, icon: Truck, title: 'Receber em casa', desc: 'Correios ou transportadora. Frete calculado pelo CEP.' }] : []),
  ]

  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold text-gray-900">Como você quer receber?</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map(({ value: v, icon: Icon, title, desc }) => (
          <label
            key={v}
            className={cn(
              'flex cursor-pointer gap-3 rounded-2xl border-2 p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-grape',
              value.method === v ? 'border-brand-rose bg-brand-blush' : 'border-gray-200 hover:border-brand-pink',
            )}
          >
            <input type="radio" name="delivery" value={v} checked={value.method === v} onChange={() => onChange((d) => ({ ...d, method: v }))} className="sr-only" />
            <Icon size={20} className="mt-0.5 shrink-0 text-brand-rose" />
            <span>
              <span className="block text-sm font-semibold text-gray-900">{title}</span>
              <span className="block text-xs text-gray-600">{desc}</span>
            </span>
          </label>
        ))}
      </div>
      {errors.deliveryMethod && <p className="text-sm text-red-600">{errors.deliveryMethod}</p>}

      {value.method === 'shipping' && (
        <div className="space-y-4 rounded-2xl bg-gray-50 p-4">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
            <Field label="CEP" error={errors.postalCode ?? quoteError}>
              <Input
                inputMode="numeric"
                autoComplete="postal-code"
                value={maskCep(value.address.postalCode)}
                onChange={(e) => setAddress({ postalCode: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                placeholder="88058-000"
              />
            </Field>
            <a
              href="https://buscacepinter.correios.com.br/app/endereco/index.php"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-grape underline sm:mt-9"
            >
              Não sei meu CEP
            </a>
          </div>

          <div aria-live="polite">
            {quoting ? (
              <p className="flex items-center gap-2 text-sm text-gray-600">
                <Spinner className="h-4 w-4" /> Calculando o frete…
              </p>
            ) : value.options.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Opções de envio</p>
                {value.options.map((o) => (
                  <label
                    key={o.serviceId}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-2xl border-2 bg-white p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-grape',
                      value.serviceId === o.serviceId ? 'border-brand-rose' : 'border-gray-200 hover:border-brand-pink',
                    )}
                  >
                    <input
                      type="radio"
                      name="shipping-service"
                      checked={value.serviceId === o.serviceId}
                      onChange={() => onChange((d) => ({ ...d, serviceId: o.serviceId }))}
                      className="sr-only"
                    />
                    <Package size={18} className="shrink-0 text-brand-grape" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-900">{[o.company, o.service].filter(Boolean).join(' · ')}</span>
                      <span className="block text-xs text-gray-600">{daysLabel(o)} após o envio</span>
                    </span>
                    <span className="font-semibold tabular-nums text-gray-900">{formatBRL(o.priceCents)}</span>
                  </label>
                ))}
                {errors.shippingServiceId && <p className="text-sm text-red-600">{errors.shippingServiceId}</p>}
                <p className="text-xs text-gray-500">O prazo conta a partir do envio, depois da produção do seu kit.</p>
              </div>
            ) : errors.shippingServiceId && !quoteError ? (
              <p className="text-sm text-red-600">{errors.shippingServiceId}</p>
            ) : null}
          </div>

          {(value.options.length > 0 || value.address.street || Object.keys(errors).some((k) => ['street', 'number', 'district', 'city', 'state'].includes(k))) && (
            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Rua" error={errors.street} className="sm:col-span-4">
                <Input value={value.address.street} onChange={(e) => setAddress({ street: e.target.value })} autoComplete="address-line1" maxLength={200} />
              </Field>
              <Field label="Número" error={errors.number} className="sm:col-span-2">
                <Input value={value.address.number} onChange={(e) => setAddress({ number: e.target.value })} maxLength={20} placeholder="123" />
              </Field>
              <Field label="Complemento (opcional)" error={errors.complement} className="sm:col-span-3">
                <Input value={value.address.complement} onChange={(e) => setAddress({ complement: e.target.value })} autoComplete="address-line2" maxLength={100} placeholder="Apto, bloco…" />
              </Field>
              <Field label="Bairro" error={errors.district} className="sm:col-span-3">
                <Input value={value.address.district} onChange={(e) => setAddress({ district: e.target.value })} maxLength={100} />
              </Field>
              <Field label="Cidade" error={errors.city} className="sm:col-span-4">
                <Input value={value.address.city} onChange={(e) => setAddress({ city: e.target.value })} autoComplete="address-level2" maxLength={100} />
              </Field>
              <Field label="UF" error={errors.state} className="sm:col-span-2">
                <Input
                  value={value.address.state}
                  onChange={(e) => setAddress({ state: e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() })}
                  autoComplete="address-level1"
                  placeholder="SC"
                />
              </Field>
            </div>
          )}
        </div>
      )}
    </fieldset>
  )
}

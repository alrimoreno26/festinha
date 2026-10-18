'use client'

// Escolha de quantidade: opções configuradas e, quando o pacote cobra por folha (impressão de cartões),
// uma quantidade livre abaixo do mínimo, cobrada por folha A4. O preço exibido é uma prévia;
// o servidor recalcula ao criar o pedido.

import { Input } from '@/components/ui'
import { cn } from '@/lib/cn'
import { perSheetVariant, PER_SHEET_ID, sheetsFor, validCustomQuantity, type PublicPackage } from '@/lib/contracts'
import { formatBRL } from '@/lib/format'
import { Info } from 'lucide-react'

export interface QuantityValue {
  variantId: string | null
  quantity: number | null
}

const option = (selected: boolean) =>
  cn(
    'flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 sm:p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-grape',
    selected ? 'border-brand-rose bg-brand-blush' : 'border-gray-200 bg-white hover:border-brand-pink',
  )

export function QuantityPicker({
  pkg,
  value,
  onChange,
  error,
}: {
  pkg: Pick<PublicPackage, 'variants' | 'sheetPricing'>
  value: QuantityValue
  onChange: (v: QuantityValue) => void
  error?: string
}) {
  const sp = pkg.sheetPricing
  const custom = value.variantId === PER_SHEET_ID
  const preview = sp && custom && validCustomQuantity(sp, value.quantity) ? perSheetVariant(sp, value.quantity) : null

  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Quantidade</legend>
      {sp && (
        <p className="flex items-start gap-2 rounded-2xl bg-brand-lilac/40 px-3 py-2 text-sm text-brand-ink">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>
            Em cada folha A4 cabem <strong>{sp.cardsPerSheet} cartões</strong>. Até {sp.minUnitsForOptions - 1} cartões, você paga{' '}
            <strong>{formatBRL(sp.sheetPriceCents)} por folha</strong>; a partir de {sp.minUnitsForOptions}, escolha um pacote.
          </span>
        </p>
      )}

      {sp && (
        <label className={option(custom)}>
          <input
            type="radio"
            name="variant"
            checked={custom}
            onChange={() => onChange({ variantId: PER_SHEET_ID, quantity: value.quantity ?? sp.cardsPerSheet })}
            className="sr-only"
          />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-gray-900">Quantidade avulsa</span>
            <span className="block text-xs text-gray-600">De 1 a {sp.minUnitsForOptions - 1} cartões, por folha</span>
          </span>
          {custom ? (
            <span className="flex items-center gap-2">
              <span className="w-20">
                <Input
                  type="number"
                  min={1}
                  max={sp.minUnitsForOptions - 1}
                  inputMode="numeric"
                  value={value.quantity ?? ''}
                  onChange={(e) => onChange({ variantId: PER_SHEET_ID, quantity: e.target.value ? Number(e.target.value) : null })}
                  aria-label="Quantidade de cartões"
                />
              </span>
            </span>
          ) : (
            <span className="font-display text-lg font-bold tabular-nums text-brand-rose">{formatBRL(sp.sheetPriceCents)}</span>
          )}
        </label>
      )}
      {sp && custom && (
        <p className={cn('px-1 text-sm', preview ? 'text-gray-700' : 'text-red-600')}>
          {preview
            ? `${preview.sheets} ${preview.sheets === 1 ? 'folha' : 'folhas'} A4 · ${formatBRL(preview.priceCents)}`
            : `Informe de 1 a ${sp.minUnitsForOptions - 1} cartões (para ${sp.minUnitsForOptions} ou mais, escolha um pacote abaixo).`}
        </p>
      )}

      {pkg.variants.map((v) => (
        <label key={v.id} className={option(value.variantId === v.id)}>
          <input type="radio" name="variant" checked={value.variantId === v.id} onChange={() => onChange({ variantId: v.id, quantity: null })} className="sr-only" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-gray-900">{v.label}</span>
            {sp && v.quantity && (
              <span className="block text-xs text-gray-600">
                {sheetsFor(v.quantity, sp.cardsPerSheet)} folhas A4 · {formatBRL(Math.round(v.priceCents / v.quantity))} por cartão
              </span>
            )}
          </span>
          <span className="font-display text-lg font-bold tabular-nums text-brand-rose">{formatBRL(v.priceCents)}</span>
        </label>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </fieldset>
  )
}

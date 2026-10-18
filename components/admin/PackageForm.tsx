'use client'

import { PackageCover } from '@/components/catalog/PackageCard'
import { Button, ButtonLink, Card, ConfirmDialog, Field, FileIcon, Input, PACKAGE_KIND, Select, Switch, Textarea, useToast } from '@/components/ui'
import { formatBRL, formatBytes, parseBRL, slugify, unitsLabel } from '@/lib/format'
import { errorMessage, filesService, packagesService, qk, ServiceError } from '@/lib/services'
import type { PackageInput } from '@/lib/services/packages'
import type { CustomizationLevel, Package, PackageItem, PackageKind, ProductLine } from '@/lib/types'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import { FilePicker } from './FilePicker'

const centsToText = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

const KIND_HELP: Record<PackageKind, string> = {
  digital: 'Arquivos prontos: o cliente baixa assim que o pagamento é aprovado.',
  custom_digital: 'Você cria a arte depois da compra com os dados do cliente e envia o arquivo final no pedido.',
  printed: 'Você produz e o cliente retira no local ou recebe pelos Correios/transportadora (frete do Melhor Envio calculado no checkout).',
}

type ItemRow = { name: string; quantity: string }

export function PackageForm({ pkg }: { pkg?: Package }) {
  const router = useRouter()
  const toast = useToast()
  const coverInput = useRef<HTMLInputElement>(null)
  const filesQuery = useQuery({ queryKey: qk.allFiles, queryFn: filesService.listAll })

  const [title, setTitle] = useState(pkg?.title ?? '')
  const [slug, setSlug] = useState(pkg?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(!!pkg)
  const [description, setDescription] = useState(pkg?.description ?? '')
  const [price, setPrice] = useState(pkg ? centsToText(pkg.priceCents) : '')
  const [accessMode, setAccessMode] = useState<'life' | 'days'>(pkg?.accessDays ? 'days' : 'life')
  const [accessDays, setAccessDays] = useState(String(pkg?.accessDays ?? 30))
  const [active, setActive] = useState(pkg?.active ?? false)
  const [coverUrl, setCoverUrl] = useState<string | null>(pkg?.coverUrl ?? null)
  const [fileIds, setFileIds] = useState<string[]>(pkg?.fileIds ?? [])
  const [kind, setKind] = useState<PackageKind>(pkg?.kind ?? 'digital')
  const [items, setItems] = useState<ItemRow[]>((pkg?.items ?? []).map((i) => ({ name: i.name, quantity: String(i.quantity) })))
  const [level, setLevel] = useState<CustomizationLevel>(
    pkg?.customizationLevel === 'theme' || pkg?.customizationLevel === 'business' ? pkg.customizationLevel : 'full',
  )
  const [line, setLine] = useState<ProductLine>(pkg?.line ?? 'festas')
  type VariantRow = { id: string; label: string; price: string }
  const [variants, setVariants] = useState<VariantRow[]>((pkg?.variants ?? []).map((v) => ({ id: v.id, label: v.label, price: centsToText(v.priceCents) })))
  const setVariant = (index: number, patch: Partial<VariantRow>) => setVariants((list) => list.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  // Papelaria para empresas pede os dados da marca no checkout.
  const changeLine = (next: ProductLine) => {
    setLine(next)
    if (next === 'empresas') setLevel('business')
    else if (level === 'business') setLevel('full')
  }
  const [box, setBox] = useState({
    weightGrams: String(pkg?.shippingBox?.weightGrams ?? ''),
    heightCm: String(pkg?.shippingBox?.heightCm ?? ''),
    widthCm: String(pkg?.shippingBox?.widthCm ?? ''),
    lengthCm: String(pkg?.shippingBox?.lengthCm ?? ''),
  })
  const boxFilled = Object.values(box).some((v) => v.trim())
  const digital = kind === 'digital'
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const input = (): PackageInput => ({
    title,
    slug: slugTouched ? slug : slugify(title),
    description,
    coverUrl,
    priceCents: parseBRL(price) ?? 0,
    active,
    accessDays: accessMode === 'life' ? null : Number(accessDays),
    fileIds,
    kind,
    items: items.filter((i) => i.name.trim()).map((i): PackageItem => ({ name: i.name, quantity: Number(i.quantity) })),
    customizationLevel: level,
    // Sem nenhuma medida preenchida = sem envio (só retirada).
    line,
    variants: variants
      .filter((v) => v.label.trim())
      .map((v) => ({ id: v.id, label: v.label, priceCents: parseBRL(v.price) ?? 0 })),
    shippingBox: boxFilled
      ? { weightGrams: Number(box.weightGrams), heightCm: Number(box.heightCm), widthCm: Number(box.widthCm), lengthCm: Number(box.lengthCm) }
      : null,
  })

  const setItem = (index: number, patch: Partial<ItemRow>) => setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  const totalItems = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)

  const save = useMutation({
    mutationFn: () => (pkg ? packagesService.update(pkg.id, input()) : packagesService.create(input())),
    onSuccess: (saved) => {
      toast.success(pkg ? 'Pacote salvo.' : 'Pacote criado.')
      if (!pkg) router.replace(`/admin/pacotes/${saved.id}`)
    },
    onError: (err) => {
      if (!(err instanceof ServiceError && err.code === 'VALIDATION')) toast.error(errorMessage(err))
    },
  })

  const remove = useMutation({
    mutationFn: () => packagesService.remove(pkg!.id),
    onSuccess: () => {
      toast.success('Pacote excluído.')
      router.replace('/admin/pacotes')
    },
    onError: (err) => {
      setConfirmDelete(false)
      toast.error(errorMessage(err))
    },
  })

  const cover = useMutation({
    mutationFn: (file: File) => packagesService.uploadCover(file),
    onSuccess: ({ url }) => setCoverUrl(url),
    onError: (err) => toast.error(errorMessage(err)),
  })

  const errors = save.error instanceof ServiceError && save.error.code === 'VALIDATION' ? save.error.details ?? {} : {}
  const filesById = new Map((filesQuery.data ?? []).map((f) => [f.id, f]))
  const selectedFiles = fileIds.map((id) => filesById.get(id)).filter((f) => !!f)
  const totalSize = selectedFiles.reduce((s, f) => s + f!.size, 0)

  const move = (index: number, delta: number) =>
    setFileIds((ids) => {
      const next = [...ids]
      const target = index + delta
      if (target < 0 || target >= next.length) return ids
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  const parsedPrice = parseBRL(price)

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="space-y-6 min-w-0">
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Informações</h2>
          <Field label="Linha" hint={line === 'empresas' ? 'Cartões, tags e etiquetas para outros negócios.' : 'Kits e papelaria para festas.'}>
            <Select value={line} onChange={(e) => changeLine(e.target.value as ProductLine)}>
              <option value="festas">Festas</option>
              <option value="empresas">Para empresas</option>
            </Select>
          </Field>
          <Field label="Tipo de pacote" hint={KIND_HELP[kind]}>
            <Select value={kind} onChange={(e) => setKind(e.target.value as PackageKind)}>
              {(Object.keys(PACKAGE_KIND) as PackageKind[]).map((k) => (
                <option key={k} value={k}>
                  {PACKAGE_KIND[k].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Título" error={errors.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kit Safári" />
          </Field>
          <Field label="Endereço no site" hint={`festinhas.com.br/pacotes/${slugTouched ? slug : slugify(title) || '…'}`} error={errors.slug}>
            <Input
              value={slugTouched ? slug : slugify(title)}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(slugify(e.target.value))
              }}
              placeholder="kit-safari"
            />
          </Field>
          <Field label="Descrição" hint="O que vem no kit, para quem é, dicas de impressão.">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
          </Field>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">O que vem no pacote</h2>
              <p className="text-sm text-gray-500">
                {digital ? 'Opcional: aparece na página do kit.' : 'Obrigatório: é o que o cliente compra.'}
                {totalItems > 0 && ` Total: ${unitsLabel(totalItems)}.`}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setItems((list) => [...list, { name: '', quantity: '1' }])}>
              <Plus size={14} /> Item
            </Button>
          </div>
          {errors.items && <p className="mt-3 text-sm text-red-600">{errors.items}</p>}
          {items.length === 0 ? (
            <div className="mt-4 rounded-2xl border-2 border-dashed border-gray-200 py-6 text-center text-sm text-gray-500">
              Nenhum item. Ex.: 5 · Caixa Milk – 14 cm x 6,5 cm
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {items.map((it, i) => (
                <li key={i} className="flex items-center gap-2">
                  <div className="w-20 shrink-0">
                    <Input type="number" min={1} value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} aria-label="Quantidade" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Caixa Milk – 14 cm x 6,5 cm" aria-label="Item" />
                  </div>
                  <button type="button" onClick={() => setItems((list) => list.filter((_, j) => j !== i))} className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label="Remover item">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {kind === 'printed' && (
          <Card className="p-6">
            <h2 className="font-semibold text-gray-900">Embalagem para envio</h2>
            <p className="text-sm text-gray-500">
              Peso e medidas da caixa já montada, para calcular o frete no Melhor Envio. Sem isso, o cliente só pode escolher retirada.
            </p>
            {errors.shippingBox && <p className="mt-3 text-sm text-red-600">{errors.shippingBox}</p>}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['weightGrams', 'Peso (g)', '400'],
                  ['heightCm', 'Altura (cm)', '10'],
                  ['widthCm', 'Largura (cm)', '20'],
                  ['lengthCm', 'Comprimento (cm)', '30'],
                ] as const
              ).map(([key, label, placeholder]) => (
                <Field key={key} label={label}>
                  <Input type="number" min={1} inputMode="numeric" value={box[key]} onChange={(e) => setBox((b) => ({ ...b, [key]: e.target.value }))} placeholder={placeholder} />
                </Field>
              ))}
            </div>
          </Card>
        )}

        {digital && (
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-gray-900">Arquivos do pacote</h2>
                <p className="text-sm text-gray-500">
                  {fileIds.length} arquivos · {formatBytes(totalSize)} — a ordem aqui é a ordem que o cliente vê.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)} disabled={filesQuery.isPending}>
                <Plus size={14} /> Escolher
              </Button>
            </div>
            {errors.fileIds && <p className="mt-3 text-sm text-red-600">{errors.fileIds}</p>}
            {selectedFiles.length === 0 ? (
              <div className="mt-4 rounded-2xl border-2 border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">Nenhum arquivo selecionado.</div>
            ) : (
              <ul className="mt-4 divide-y divide-black/5 rounded-2xl border border-black/5">
                {selectedFiles.map((f, i) => (
                  <li key={f!.id} className="flex items-center gap-3 px-3 py-2">
                    <FileIcon mime={f!.mime} className="h-8 w-8" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-800">{f!.filename}</p>
                      <p className="truncate text-xs text-gray-400">{f!.key}</p>
                    </div>
                    <div className="flex items-center">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg p-1.5 text-gray-500 hover:bg-black/5 disabled:opacity-30" aria-label="Subir">
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === selectedFiles.length - 1} className="rounded-lg p-1.5 text-gray-500 hover:bg-black/5 disabled:opacity-30" aria-label="Descer">
                        <ArrowDown size={14} />
                      </button>
                      <button type="button" onClick={() => setFileIds((ids) => ids.filter((id) => id !== f!.id))} className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label={`Remover ${f!.filename}`}>
                        <X size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {pkg && (
          <Card className="p-6 border-red-100">
            <h2 className="font-semibold text-gray-900">Excluir pacote</h2>
            <p className="mt-1 text-sm text-gray-600">Só é possível excluir pacotes sem vendas. Pacotes vendidos devem ser ocultados do catálogo.</p>
            <Button variant="outline" size="sm" className="mt-4 !border-red-300 !text-red-600 hover:!bg-red-50" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} /> Excluir pacote
            </Button>
          </Card>
        )}
      </div>

      <div className="space-y-6 lg:sticky lg:top-6">
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Venda</h2>
          {variants.length === 0 && (
            <Field label="Preço (R$)" error={errors.priceCents} hint={parsedPrice ? formatBRL(parsedPrice) : undefined}>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="49,90" />
            </Field>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-700">Opções de quantidade</p>
              <Button variant="ghost" size="sm" onClick={() => setVariants((list) => [...list, { id: '', label: '', price: '' }])}>
                <Plus size={14} /> Opção
              </Button>
            </div>
            {variants.length === 0 ? (
              <p className="text-xs text-gray-500">Opcional. Ex.: 50 unidades por R$ 39,90 e 100 unidades por R$ 69,90. O cliente escolhe na compra.</p>
            ) : (
              <ul className="space-y-2">
                {variants.map((v, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Input value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} placeholder="100 unidades" aria-label="Nome da opção" maxLength={80} />
                    </div>
                    <div className="w-24 shrink-0">
                      <Input value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} inputMode="decimal" placeholder="59,90" aria-label="Preço da opção" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setVariants((list) => list.filter((_, j) => j !== i))}
                      className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remover opção"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {errors.variants && <p className="text-sm text-red-600">{errors.variants}</p>}
          </div>
          {digital ? (
            <>
              <Field label="Acesso após a compra">
                <Select value={accessMode} onChange={(e) => setAccessMode(e.target.value as 'life' | 'days')}>
                  <option value="life">Vitalício</option>
                  <option value="days">Por um número de dias</option>
                </Select>
              </Field>
              {accessMode === 'days' && (
                <Field label="Dias de acesso" error={errors.accessDays}>
                  <Input type="number" min={1} value={accessDays} onChange={(e) => setAccessDays(e.target.value)} />
                </Field>
              )}
            </>
          ) : (
            <>
              <Field label="O que pedir no checkout">
                <Select value={level} onChange={(e) => setLevel(e.target.value as CustomizationLevel)}>
                  <option value="full">Nome, idade, tema e cores (festa)</option>
                  {kind === 'custom_digital' && <option value="theme">Só o tema (ex.: tema individual)</option>}
                  <option value="business">Marca, textos e logo (empresa)</option>
                </Select>
              </Field>
              <p className="rounded-2xl bg-brand-blush p-3 text-xs text-brand-ink">
                {level === 'business'
                  ? 'O checkout pede o nome da marca, os textos do cartão, as cores e o logo (o cliente envia o arquivo).'
                  : kind === 'custom_digital' && level === 'theme'
                    ? 'O checkout pede o tema e observações. Você envia os arquivos do tema escolhido no pedido.'
                    : 'O checkout pede nome, idade, tema, cores e observações.'}
                {kind === 'printed' && ' Também pede retirada ou envio.'}
              </p>
            </>
          )}
          <div className="rounded-2xl bg-gray-50 p-3">
            <Switch checked={active} onChange={setActive} label={active ? 'Visível no catálogo' : 'Oculto (rascunho)'} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Capa</h2>
          <div className="overflow-hidden rounded-2xl border border-black/5">
            <PackageCover src={coverUrl} alt="" className="aspect-square w-full" />
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => coverInput.current?.click()} loading={cover.isPending}>
              <ImagePlus size={14} /> {coverUrl ? 'Trocar' : 'Enviar imagem'}
            </Button>
            {coverUrl && (
              <Button variant="ghost" size="sm" onClick={() => setCoverUrl(null)}>
                Remover
              </Button>
            )}
          </div>
          <input
            ref={coverInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) cover.mutate(file)
              e.target.value = ''
            }}
          />
        </Card>

        <div className="flex flex-col gap-2">
          {Object.keys(errors).length > 0 && <p className="text-sm text-red-600 text-center">{errorMessage(save.error)}</p>}
          <Button type="submit" size="lg" loading={save.isPending}>
            {pkg ? 'Salvar alterações' : 'Criar pacote'}
          </Button>
          {pkg?.active && (
            <ButtonLink href={`/pacotes/${pkg.slug}`} target="_blank" variant="ghost">
              <ExternalLink size={14} /> Ver no site
            </ButtonLink>
          )}
        </div>
      </div>

      <FilePicker open={pickerOpen} onClose={() => setPickerOpen(false)} files={filesQuery.data ?? []} selected={fileIds} onConfirm={setFileIds} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title={`Excluir ${pkg?.title}?`}
        description="Esta ação não pode ser desfeita. Os arquivos continuam no bucket."
        confirmLabel="Excluir"
      />
    </form>
  )
}

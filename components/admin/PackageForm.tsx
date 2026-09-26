'use client'

import { PackageCover } from '@/components/catalog/PackageCard'
import { Button, ButtonLink, Card, ConfirmDialog, Field, FileIcon, Input, Select, Switch, Textarea, useToast } from '@/components/ui'
import { formatBRL, formatBytes, parseBRL, slugify } from '@/lib/format'
import { errorMessage, filesService, packagesService, qk, ServiceError } from '@/lib/services'
import type { PackageInput } from '@/lib/services/packages'
import type { Package } from '@/lib/types'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import { FilePicker } from './FilePicker'

const centsToText = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

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
  })

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
          <Field label="Preço (R$)" error={errors.priceCents} hint={parsedPrice ? formatBRL(parsedPrice) : undefined}>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="49,90" />
          </Field>
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
          <div className="rounded-2xl bg-gray-50 p-3">
            <Switch checked={active} onChange={setActive} label={active ? 'Visível no catálogo' : 'Oculto (rascunho)'} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Capa</h2>
          <div className="overflow-hidden rounded-2xl border border-black/5">
            <PackageCover src={coverUrl} alt="" className="aspect-[4/3] w-full" />
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

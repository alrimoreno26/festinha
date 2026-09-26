'use client'

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dropzone,
  EmptyState,
  Field,
  FileIcon,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  ProgressBar,
  QueryState,
  useToast,
} from '@/components/ui'
import { formatBytes, formatDate } from '@/lib/format'
import { errorMessage, filesService, qk } from '@/lib/services'
import { MAX_UPLOAD_BYTES, type FolderListing } from '@/lib/services/files'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Folder, FolderPlus, Home, Pencil, RotateCcw, Trash2, Upload, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState, type FormEvent } from 'react'

type ListedFile = FolderListing['files'][number]

interface UploadItem {
  id: number
  file: File
  folder: string
  progress: number
  status: 'uploading' | 'done' | 'error'
  error?: string
}

let uploadSeq = 1

function Breadcrumb({ path }: { path: string }) {
  const parts = path ? path.split('/') : []
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Pastas">
      <Link href="/admin/arquivos" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-gray-600 hover:bg-black/5">
        <Home size={14} /> bucket
      </Link>
      {parts.map((part, i) => {
        const href = `/admin/arquivos?pasta=${encodeURIComponent(parts.slice(0, i + 1).join('/'))}`
        const last = i === parts.length - 1
        return (
          <span key={href} className="inline-flex items-center gap-1">
            <ChevronRight size={14} className="text-gray-300" />
            {last ? (
              <span className="px-2 py-1 font-medium text-gray-900">{part}</span>
            ) : (
              <Link href={href} className="rounded-lg px-2 py-1 text-gray-600 hover:bg-black/5">
                {part}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}

function Explorer() {
  const path = useSearchParams().get('pasta') ?? ''
  const router = useRouter()
  const toast = useToast()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: qk.folder(path), queryFn: () => filesService.listFolder(path) })

  const [showUpload, setShowUpload] = useState(false)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [newFolder, setNewFolder] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ file: ListedFile; name: string } | null>(null)
  const [deleting, setDeleting] = useState<ListedFile | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null)

  const patch = (id: number, data: Partial<UploadItem>) => setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...data } : u)))

  const runUpload = async (item: UploadItem) => {
    patch(item.id, { status: 'uploading', progress: 0, error: undefined })
    try {
      await filesService.upload(item.file, item.folder, (progress) => patch(item.id, { progress }))
      patch(item.id, { status: 'done', progress: 100 })
      // O upload não passa por useMutation: avisa as listas (pasta atual, seletor de arquivos).
      queryClient.invalidateQueries({ queryKey: ['admin', 'files'] })
    } catch (err) {
      patch(item.id, { status: 'error', error: errorMessage(err) })
    }
  }

  const startUploads = async (files: File[]) => {
    const items = files.map((file) => ({ id: uploadSeq++, file, folder: path, progress: 0, status: 'uploading' as const }))
    setUploads((list) => [...items, ...list])
    for (const item of items) await runUpload(item)
  }

  const createFolder = useMutation({
    mutationFn: (name: string) => filesService.createFolder(path, name),
    onSuccess: (created) => {
      setNewFolder(null)
      router.push(`/admin/arquivos?pasta=${encodeURIComponent(created)}`)
    },
  })
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => filesService.rename(id, name),
    onSuccess: () => {
      setRenaming(null)
      toast.success('Arquivo renomeado.')
    },
  })
  const remove = useMutation({
    mutationFn: (file: ListedFile) => filesService.remove(file.id, { force: file.usedIn.length > 0 }),
    onSuccess: () => {
      setDeleting(null)
      toast.success('Arquivo excluído.')
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  const removeFolder = useMutation({
    mutationFn: (folder: string) => filesService.removeFolder(folder),
    onSuccess: () => {
      setDeletingFolder(null)
      toast.success('Pasta excluída.')
    },
    onError: (err) => {
      setDeletingFolder(null)
      toast.error(errorMessage(err))
    },
  })

  const activeUploads = uploads.filter((u) => u.status !== 'done' || u.folder === path)

  return (
    <>
      <PageHeader
        title="Arquivos"
        description="Conteúdo do bucket (Cloudflare R2). Os clientes nunca veem estes caminhos."
        actions={
          <>
            <Button variant="outline" onClick={() => setNewFolder('')}>
              <FolderPlus size={16} /> Nova pasta
            </Button>
            <Button onClick={() => setShowUpload((v) => !v)}>
              <Upload size={16} /> Enviar arquivos
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <Breadcrumb path={path} />
      </div>

      {showUpload && (
        <div className="mb-6">
          <Dropzone onFiles={startUploads} hint={`Serão enviados para /${path || ''} · até ${formatBytes(MAX_UPLOAD_BYTES)} por arquivo`} />
        </div>
      )}

      {activeUploads.length > 0 && (
        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-900">Envios</p>
            <button className="text-xs text-gray-500 hover:text-gray-800" onClick={() => setUploads((l) => l.filter((u) => u.status === 'uploading'))}>
              Limpar concluídos
            </button>
          </div>
          <ul className="space-y-3">
            {activeUploads.map((u) => (
              <li key={u.id} className="text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-gray-800">{u.file.name}</span>
                  <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                    {u.status === 'done' ? 'Concluído' : u.status === 'error' ? 'Falhou' : `${u.progress}%`} · {formatBytes(u.file.size)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1">
                    <ProgressBar value={u.status === 'error' ? 100 : u.progress} tone={u.status === 'error' ? 'danger' : u.status === 'done' ? 'teal' : 'coral'} />
                  </div>
                  {u.status === 'error' && (
                    <>
                      <button onClick={() => runUpload(u)} className="text-gray-500 hover:text-gray-900" aria-label="Tentar de novo">
                        <RotateCcw size={14} />
                      </button>
                      <button onClick={() => setUploads((l) => l.filter((x) => x.id !== u.id))} className="text-gray-500 hover:text-gray-900" aria-label="Descartar">
                        <X size={14} />
                      </button>
                    </>
                  )}
                </div>
                {u.error && <p className="mt-1 text-xs text-red-600">{u.error}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <QueryState query={query}>
        {({ folders, files }) =>
          folders.length === 0 && files.length === 0 ? (
            <Card>
              <EmptyState
                icon={Folder}
                title="Pasta vazia"
                description="Envie arquivos ou crie uma subpasta."
                action={
                  <div className="flex gap-2">
                    <Button onClick={() => setShowUpload(true)}>Enviar arquivos</Button>
                    {path && (
                      <Button variant="ghost" onClick={() => setDeletingFolder(path)}>
                        Excluir pasta
                      </Button>
                    )}
                  </div>
                }
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-black/5">
                {folders.map((f) => (
                  <li key={f.path}>
                    <Link href={`/admin/arquivos?pasta=${encodeURIComponent(f.path)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-sand/40">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                        <Folder size={20} />
                      </span>
                      <span className="flex-1 font-medium text-gray-800">{f.name}</span>
                      <span className="text-xs text-gray-500">{f.fileCount} arquivos</span>
                      <ChevronRight size={16} className="text-gray-300" />
                    </Link>
                  </li>
                ))}
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                    <FileIcon mime={f.mime} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">{f.filename}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                        <span>{formatBytes(f.size)}</span>
                        <span>·</span>
                        <span>{formatDate(f.createdAt)}</span>
                        {f.usedIn.length === 0 ? (
                          <Badge tone="neutral">Não usado</Badge>
                        ) : (
                          f.usedIn.map((p) => (
                            <Link key={p.id} href={`/admin/pacotes/${p.id}`}>
                              <Badge tone="info">{p.title}</Badge>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                    <button onClick={() => setRenaming({ file: f, name: f.filename })} className="rounded-lg p-2 text-gray-500 hover:bg-black/5" aria-label={`Renomear ${f.filename}`}>
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => setDeleting(f)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label={`Excluir ${f.filename}`}>
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )
        }
      </QueryState>

      <Modal
        open={newFolder !== null}
        onClose={() => setNewFolder(null)}
        title="Nova pasta"
        description={`Dentro de /${path}`}
        locked={createFolder.isPending}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewFolder(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="new-folder" loading={createFolder.isPending} disabled={!newFolder?.trim()}>
              Criar
            </Button>
          </>
        }
      >
        <form
          id="new-folder"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (newFolder) createFolder.mutate(newFolder)
          }}
        >
          <Field label="Nome" error={createFolder.isError ? errorMessage(createFolder.error) : null} hint="Ex.: kit-dinossauro">
            <Input value={newFolder ?? ''} onChange={(e) => setNewFolder(e.target.value)} autoFocus />
          </Field>
        </form>
      </Modal>

      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Renomear arquivo"
        locked={rename.isPending}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="rename-file" loading={rename.isPending}>
              Salvar
            </Button>
          </>
        }
      >
        <form
          id="rename-file"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (renaming) rename.mutate({ id: renaming.file.id, name: renaming.name })
          }}
        >
          <Field label="Nome do arquivo" error={rename.isError ? errorMessage(rename.error) : null}>
            <Input value={renaming?.name ?? ''} onChange={(e) => renaming && setRenaming({ ...renaming, name: e.target.value })} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting)
        }}
        loading={remove.isPending}
        title={`Excluir ${deleting?.filename}?`}
        description={
          deleting?.usedIn.length ? (
            <>
              Este arquivo está em <strong>{deleting.usedIn.map((p) => p.title).join(', ')}</strong>. Ele será removido desses pacotes e os clientes não poderão mais baixá-lo.
            </>
          ) : (
            'O arquivo será removido do bucket. Esta ação não pode ser desfeita.'
          )
        }
        confirmLabel="Excluir"
      />
      <ConfirmDialog
        open={!!deletingFolder}
        onClose={() => setDeletingFolder(null)}
        onConfirm={async () => {
          if (!deletingFolder) return
          const parent = deletingFolder.split('/').slice(0, -1).join('/')
          try {
            await removeFolder.mutateAsync(deletingFolder)
            router.push(parent ? `/admin/arquivos?pasta=${encodeURIComponent(parent)}` : '/admin/arquivos')
          } catch {
            // o toast de erro já é mostrado pelo onError
          }
        }}
        loading={removeFolder.isPending}
        title="Excluir pasta vazia?"
        confirmLabel="Excluir"
      />
    </>
  )
}

export default function ArquivosPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Explorer />
    </Suspense>
  )
}

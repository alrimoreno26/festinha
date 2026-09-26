'use client'

import { Button, FileIcon, Input, Modal } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/format'
import type { FileItem } from '@/lib/types'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

interface FilePickerProps {
  open: boolean
  onClose: () => void
  files: FileItem[]
  selected: string[]
  onConfirm: (ids: string[]) => void
}

const folderOf = (key: string) => key.split('/').slice(0, -1).join('/') || '(raiz)'

/** Seletor de arquivos do bucket, agrupados por pasta. */
export function FilePicker({ open, onClose, files, selected, onConfirm }: FilePickerProps) {
  const [picked, setPicked] = useState<Set<string>>(new Set(selected))
  const [search, setSearch] = useState('')
  useEffect(() => {
    if (open) {
      setPicked(new Set(selected))
      setSearch('')
    }
  }, [open, selected])

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const map = new Map<string, FileItem[]>()
    files
      .filter((f) => !q || f.key.toLowerCase().includes(q))
      .forEach((f) => map.set(folderOf(f.key), [...(map.get(folderOf(f.key)) ?? []), f]))
    return [...map.entries()]
  }, [files, search])

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleGroup = (items: FileItem[]) =>
    setPicked((s) => {
      const next = new Set(s)
      const all = items.every((f) => next.has(f.id))
      items.forEach((f) => (all ? next.delete(f.id) : next.add(f.id)))
      return next
    })

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Escolher arquivos"
      description="Marque os arquivos do bucket que fazem parte deste pacote."
      footer={
        <>
          <span className="sm:mr-auto self-center text-sm text-gray-500">{picked.size} selecionados</span>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              // Mantém a ordem atual e acrescenta os novos no fim.
              const kept = selected.filter((id) => picked.has(id))
              const added = files.filter((f) => picked.has(f.id) && !selected.includes(f.id)).map((f) => f.id)
              onConfirm([...kept, ...added])
              onClose()
            }}
          >
            Confirmar
          </Button>
        </>
      }
    >
      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou pasta" className="pl-10" />
      </div>
      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          {files.length ? 'Nenhum arquivo encontrado.' : 'O bucket está vazio. Envie arquivos em Arquivos.'}
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map(([folder, items]) => {
            const all = items.every((f) => picked.has(f.id))
            return (
              <div key={folder}>
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer">
                  <input type="checkbox" className="accent-brand-coral" checked={all} onChange={() => toggleGroup(items)} />
                  {folder}
                </label>
                <ul className="mt-2 divide-y divide-black/5 rounded-2xl border border-black/5">
                  {items.map((f) => (
                    <li key={f.id}>
                      <label className={cn('flex items-center gap-3 px-3 py-2 cursor-pointer', picked.has(f.id) && 'bg-brand-sand/60')}>
                        <input type="checkbox" className="accent-brand-coral" checked={picked.has(f.id)} onChange={() => toggle(f.id)} />
                        <FileIcon mime={f.mime} className="h-8 w-8" />
                        <span className="flex-1 min-w-0 truncate text-sm text-gray-800">{f.filename}</span>
                        <span className="text-xs text-gray-400 tabular-nums">{formatBytes(f.size)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

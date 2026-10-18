'use client'

// Checkout (papelaria para empresas): o cliente envia o logo e outros arquivos de referência.
// Cada arquivo sobe direto para o bucket; o pedido recebe só os comprovantes (id + token).

import { Spinner } from '@/components/ui'
import { CUSTOMER_UPLOAD_TYPES, MAX_CUSTOMER_UPLOADS } from '@/lib/contracts'
import { formatBytes } from '@/lib/format'
import { errorMessage, uploadsService } from '@/lib/services'
import { CheckCircle2, ImagePlus, X } from 'lucide-react'
import { useRef, useState } from 'react'

export interface UploadedFile {
  id: string
  token: string
  name: string
  size: number
}

export function LogoUpload({
  value,
  onChange,
  error,
  required,
}: {
  value: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
  error?: string
  /** Impressão do design do cliente: o arquivo é obrigatório. */
  required?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const send = async (list: FileList | null) => {
    if (!list?.length) return
    setFailure(null)
    let current = value
    for (const file of Array.from(list).slice(0, MAX_CUSTOMER_UPLOADS - current.length)) {
      setSending(file.name)
      try {
        const ticket = await uploadsService.upload(file)
        current = [...current, { ...ticket, name: file.name, size: file.size }]
        onChange(current)
      } catch (err) {
        setFailure(`${file.name}: ${errorMessage(err)}`)
        break
      }
    }
    setSending(null)
    if (input.current) input.current.value = ''
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{required ? 'Arquivo do design (frente e verso, se houver)' : 'Logo e referências (opcional)'}</p>
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-black/5">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-gray-400">{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v.id !== f.id))}
                className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Remover ${f.name}`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {sending ? (
        <p className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600">
          <Spinner className="h-4 w-4" /> Enviando {sending}…
        </p>
      ) : (
        value.length < MAX_CUSTOMER_UPLOADS && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-lilac bg-brand-blush/50 px-4 py-3 text-sm font-semibold text-brand-grape hover:bg-brand-blush"
          >
            <ImagePlus size={18} /> {value.length ? 'Enviar outro arquivo' : required ? 'Enviar o design' : 'Enviar o logo'}
          </button>
        )
      )}
      <input ref={input} type="file" accept={CUSTOMER_UPLOAD_TYPES.join(',')} multiple className="hidden" onChange={(e) => send(e.target.files)} />
      <p className="text-xs text-gray-500">
        {required
          ? 'PDF ou imagem em alta resolução (300 dpi), até 15 MB. Se tiver frente e verso, envie os dois.'
          : 'PNG, JPG, SVG ou PDF, até 15 MB. Se preferir, mande depois pelo WhatsApp.'}
      </p>
      {(failure || error) && <p className="text-sm text-red-600">{failure ?? error}</p>}
    </div>
  )
}

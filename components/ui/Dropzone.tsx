'use client'

import { cn } from '@/lib/cn'
import { UploadCloud } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

interface DropzoneProps {
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  disabled?: boolean
  title?: ReactNode
  hint?: ReactNode
  className?: string
}

export function Dropzone({
  onFiles,
  accept,
  multiple = true,
  disabled,
  title = 'Arraste arquivos aqui ou clique para escolher',
  hint,
  className,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handle = (list: FileList | null) => {
    if (!list || disabled) return
    const files = Array.from(list)
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handle(e.dataTransfer.files)
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal',
        dragging ? 'border-brand-teal bg-brand-teal/5' : 'border-gray-300 bg-white hover:border-brand-teal/60',
        disabled && 'opacity-60 cursor-not-allowed',
        className,
      )}
    >
      <UploadCloud className={dragging ? 'text-brand-teal' : 'text-gray-400'} size={32} />
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          handle(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export function ProgressBar({ value, tone = 'teal' }: { value: number; tone?: 'teal' | 'coral' | 'danger' }) {
  const color = { teal: 'bg-brand-teal', coral: 'bg-brand-coral', danger: 'bg-red-500' }[tone]
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/[.06]" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-[width] duration-200', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

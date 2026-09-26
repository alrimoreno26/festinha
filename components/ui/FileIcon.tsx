import { cn } from '@/lib/cn'
import { File, FileArchive, FileImage, FileText } from 'lucide-react'

export function fileKind(mime: string) {
  if (mime === 'application/pdf') return { Icon: FileText, label: 'PDF', color: 'text-red-500 bg-red-50' }
  if (mime.startsWith('image/')) return { Icon: FileImage, label: mime.split('/')[1]?.toUpperCase() ?? 'Imagem', color: 'text-sky-600 bg-sky-50' }
  if (mime.includes('zip')) return { Icon: FileArchive, label: 'ZIP', color: 'text-amber-600 bg-amber-50' }
  return { Icon: File, label: 'Arquivo', color: 'text-gray-500 bg-gray-100' }
}

export function FileIcon({ mime, className }: { mime: string; className?: string }) {
  const { Icon, color } = fileKind(mime)
  return (
    <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', color, className)}>
      <Icon size={20} />
    </span>
  )
}

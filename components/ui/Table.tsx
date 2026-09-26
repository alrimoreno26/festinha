import { cn } from '@/lib/cn'
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'

/** Tabela com rolagem horizontal própria (a página nunca rola na horizontal). */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-black/5 bg-white shadow-sm">
      <table className={cn('w-full text-sm', className)} {...props} />
    </div>
  )
}

export const THead = (props: HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className="bg-brand-sand/60 text-left text-xs uppercase tracking-wide text-gray-500" {...props} />
)

export const TBody = (props: HTMLAttributes<HTMLTableSectionElement>) => <tbody className="divide-y divide-black/5" {...props} />

export function TR({ className, onClick, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn(onClick && 'cursor-pointer hover:bg-brand-sand/40', className)} onClick={onClick} {...props} />
}

export const TH = ({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('px-4 py-3 font-medium whitespace-nowrap', className)} {...props} />
)

export const TD = ({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-4 py-3 text-gray-700', className)} {...props} />
)

// Elementos visuais do catálogo: selo do logo, faixa arco-íris, bandeirinhas, onda, balões e títulos.
import { cn } from '@/lib/cn'
import Link from 'next/link'
import type { ReactNode } from 'react'

const PASTELS = ['#B5E7D5', '#D9C7F5', '#FFABE4', '#FFC2AF', '#B5E7D5', '#D9C7F5', '#FFABE4', '#FFDB8A', '#A6DEF5']

/** Selo redondo do logo + nome. `subtitle` identifica a área (Área do Cliente, Backoffice…). */
export function BrandMark({ href = '/', subtitle, size = 'md' }: { href?: string; subtitle?: string; size?: 'sm' | 'md' }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 shrink-0">
      <img
        src="/brand/selo.png"
        alt=""
        className={cn('rounded-full ring-2 ring-white shadow-sm', size === 'sm' ? 'h-10 w-10' : 'h-12 w-12')}
      />
      <div className="leading-tight">
        <p className={cn('font-display font-bold text-brand-rose', size === 'sm' ? 'text-base' : 'text-lg')}>Festinhas Criativas</p>
        <p className="text-xs font-semibold text-brand-grape">{subtitle ?? 'Papelaria'}</p>
      </div>
    </Link>
  )
}

export function RainbowStripe({ className }: { className?: string }) {
  return <div aria-hidden className={cn('rainbow-stripe h-2', className)} />
}

/** Varal de bandeirinhas pastel. */
export function Bunting({ className }: { className?: string }) {
  const n = PASTELS.length
  return (
    <svg aria-hidden viewBox="0 0 900 110" preserveAspectRatio="none" className={cn('w-full h-16 md:h-24', className)}>
      <path d="M0 8 Q450 70 900 8" fill="none" stroke="#FFDB8A" strokeWidth="6" strokeLinecap="round" />
      {PASTELS.map((c, i) => {
        const x = 20 + (i * 860) / (n - 1)
        const t = x / 900
        const y = 8 + 124 * t * (1 - t) // mesma curva da corda (bezier quadrática)
        return <path key={i} d={`M${x - 38} ${y} L${x + 38} ${y} L${x} ${y + 78} Z`} fill={c} />
      })}
    </svg>
  )
}

/** Borda ondulada (topo de rodapés e faixas). */
export function Wave({ className, color = 'currentColor', flip }: { className?: string; color?: string; flip?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 1200 60" preserveAspectRatio="none" className={cn('block w-full h-8 md:h-12', flip && 'rotate-180', className)}>
      <path d="M0 40 C150 0 300 0 450 30 S750 70 900 30 S1100 0 1200 25 V60 H0 Z" fill={color} />
    </svg>
  )
}

/** Cachinho de balões pastel (decoração de canto). */
export function Balloons({ className }: { className?: string }) {
  const balloons = [
    { cx: 30, cy: 40, c: '#FFABE4' },
    { cx: 80, cy: 22, c: '#FFDB8A' },
    { cx: 62, cy: 70, c: '#B5E7D5' },
    { cx: 22, cy: 95, c: '#A6DEF5' },
    { cx: 95, cy: 88, c: '#FFCCEF' },
  ]
  return (
    <svg aria-hidden viewBox="0 0 120 190" className={cn('w-20 md:w-28', className)}>
      {balloons.map((b, i) => (
        <g key={i}>
          <path d={`M${b.cx} ${b.cy + 22} Q${b.cx + (60 - b.cx) / 2} ${b.cy + 70} 60 175`} stroke="#FFDB8A" strokeWidth="1.5" fill="none" />
          <ellipse cx={b.cx} cy={b.cy} rx="20" ry="23" fill={b.c} />
          <ellipse cx={b.cx - 7} cy={b.cy - 9} rx="4" ry="7" fill="#fff" opacity=".6" />
        </g>
      ))}
      <path d="M52 172 q8 -8 16 0 q-8 8 -16 0" fill="#B5E7D5" />
    </svg>
  )
}

/** Título de seção no estilo do catálogo (letras arredondadas em degradê arco-íris). */
export function SectionTitle({ children, subtitle, className }: { children: ReactNode; subtitle?: ReactNode; className?: string }) {
  return (
    <div className={cn('text-center mb-10', className)}>
      <h2 className="text-rainbow inline-block text-4xl md:text-5xl font-bold uppercase tracking-wide">{children}</h2>
      {subtitle && <p className="mt-3 text-brand-text/90 max-w-2xl mx-auto">{subtitle}</p>}
    </div>
  )
}

/** Círculo numerado das etapas ("Como funciona"). */
export function StepBadge({ n, className }: { n: number; className?: string }) {
  const colors = ['bg-brand-pink', 'bg-brand-peach', 'bg-brand-sun', 'bg-brand-lilac', 'bg-brand-sky', 'bg-brand-mint']
  return (
    <span
      className={cn(
        'inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-display text-2xl font-bold text-white [text-shadow:0_1px_2px_rgb(74_51_96/.35)]',
        colors[(n - 1) % colors.length],
        className,
      )}
    >
      {n}
    </span>
  )
}

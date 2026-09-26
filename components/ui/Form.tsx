'use client'

import { cn } from '@/lib/cn'
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  cloneElement,
} from 'react'

const control = (invalid?: boolean) =>
  cn(
    'w-full rounded-2xl border bg-white px-4 text-[15px] text-gray-900 placeholder:text-gray-400 transition-shadow',
    'focus:outline-none focus:ring-2 focus:ring-brand-teal/50 focus:border-brand-teal',
    'disabled:bg-gray-50 disabled:text-gray-500',
    invalid ? 'border-red-400 focus:ring-red-300 focus:border-red-400' : 'border-gray-200',
  )

type Invalid = { invalid?: boolean }

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Invalid>(function Input(
  { invalid, className, ...props },
  ref,
) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(control(invalid), 'h-11', className)} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Invalid>(
  function Textarea({ invalid, className, rows = 4, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={cn(control(invalid), 'py-3', className)}
        {...props}
      />
    )
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Invalid>(function Select(
  { invalid, className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={cn(control(invalid), 'h-11 pr-10', className)} {...props}>
      {children}
    </select>
  )
})

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  className?: string
  /** Um único controle; recebe id, aria-describedby e invalid automaticamente. */
  children: ReactElement
}

export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      {cloneElement(children, { id, 'aria-describedby': describedBy, invalid: !!error })}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  disabled?: boolean
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <label className={cn('inline-flex items-center gap-3 cursor-pointer select-none', disabled && 'opacity-60 cursor-not-allowed')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2',
          checked ? 'bg-brand-teal' : 'bg-gray-300',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  )
}

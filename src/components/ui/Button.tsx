import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

const BASE = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-[var(--motion-fast)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95'

const VARIANTS = {
  primary:
    'bg-[var(--accent)] text-[var(--chip-active-text)] hover:brightness-110 shadow-lg',
  ghost:
    'bg-[var(--surface)] text-[var(--text-main)] border border-[var(--border-soft)] hover:bg-[var(--surface-strong)]',
  icon:
    'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface)]',
}

const SIZES = {
  sm: 'text-sm px-3 py-1.5 rounded-[var(--radius-sm)]',
  md: 'text-base px-5 py-2.5 rounded-[var(--radius-md)]',
  lg: 'text-lg px-8 py-4 rounded-[var(--radius-lg)] min-h-[var(--touch-min)]',
}

export function Button({ variant = 'ghost', size = 'md', className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

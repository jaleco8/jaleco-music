import type { ReactNode } from 'react'

interface ChipProps {
  label: ReactNode
  active: boolean
  onClick: () => void
  disabled?: boolean
  role?: 'radio' | 'checkbox'
  className?: string
}

export function Chip({ label, active, onClick, disabled = false, role = 'radio', className = '' }: ChipProps) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={`
        inline-flex items-center justify-center gap-1.5 px-4 py-2
        text-sm font-medium rounded-[var(--radius-pill)]
        transition-all duration-[var(--motion-fast)]
        cursor-pointer select-none
        min-h-[var(--touch-min)]
        active:scale-95
        disabled:opacity-40 disabled:cursor-not-allowed
        ${active
          ? 'bg-[var(--accent)] text-[var(--chip-active-text)] shadow-md'
          : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border-soft)] hover:text-[var(--text-main)] hover:bg-[var(--surface-strong)]'
        }
        ${className}
      `}
    >
      {active && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {label}
    </button>
  )
}

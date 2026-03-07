interface ProgressRingProps {
  value: number  // 0 to 1
  size?: number
  strokeWidth?: number
  className?: string
  label?: string
}

export function ProgressRing({ value, size = 48, strokeWidth = 4, className = '', label }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(1, Math.max(0, value)))

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-soft)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      {label && (
        <span className="absolute text-xs font-semibold text-[var(--text-main)]">
          {Math.round(value * 100)}%
        </span>
      )}
    </div>
  )
}

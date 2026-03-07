interface SliderProps {
  value: number
  min?: number
  max?: number
  step?: number
  label?: string
  onChange: (value: number) => void
  className?: string
}

export function Slider({ value, min = 0, max = 1, step = 0.01, label, onChange, className = '' }: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {label && <span className="text-sm text-[var(--text-muted)] whitespace-nowrap min-w-12">{label}</span>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)]
          [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
          [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--accent)]
          [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--accent) ${percent}%, var(--border-soft) ${percent}%)`,
        }}
        aria-label={label}
      />
    </div>
  )
}

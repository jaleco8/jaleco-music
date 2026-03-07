import type { Lesson, LessonProgress } from '@/types'
import { UiIcon } from '@/components/ui/Icons'

interface LessonCardProps {
  lesson: Lesson
  progress?: LessonProgress
  onClick: () => void
}

export function LessonCard({ lesson, progress, onClick }: LessonCardProps) {
  const status = progress?.status ?? 'not-started'
  const loops = progress?.completedLoops ?? 0

  return (
    <button
      onClick={onClick}
      className="
        w-full text-left px-5 py-4 rounded-[var(--radius-md)]
        bg-[var(--surface)] border border-[var(--border-soft)]
        transition-all duration-[var(--motion-fast)]
        hover:bg-[var(--surface-strong)] active:scale-[0.98]
        cursor-pointer flex items-center gap-4
      "
    >
      <div className={`
        w-10 h-10 rounded-full flex items-center justify-center shrink-0
        text-sm font-bold
        ${status === 'completed'
          ? 'bg-[var(--accent)] text-[var(--chip-active-text)]'
          : status === 'in-progress'
            ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'bg-[var(--surface-strong)] text-[var(--text-muted)] border border-[var(--border-soft)]'
        }
      `}>
        {status === 'completed' ? (
          <UiIcon name="check" size={18} />
        ) : (
          lesson.order
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-[var(--text-main)] truncate">
          {lesson.title}
        </h4>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <UiIcon name="clock" size={12} />
            {lesson.estimatedMinutes} min
          </span>
          {loops > 0 && (
            <>
              <span className="opacity-40">|</span>
              <span className="flex items-center gap-1">
                <UiIcon name="repeat" size={12} />
                {loops} reps
              </span>
            </>
          )}
        </div>
      </div>

      <UiIcon name="chevron" size={18} className="text-[var(--text-muted)] shrink-0" />
    </button>
  )
}

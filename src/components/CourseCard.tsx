import type { Course } from '@/types'
import { ProgressRing } from '@/components/ProgressRing'

interface CourseCardProps {
  course: Course
  progress: number
  lessonsCompleted: number
  totalLessons: number
  onClick: () => void
}

export function CourseCard({ course, progress, lessonsCompleted, totalLessons, onClick }: CourseCardProps) {
  return (
    <button
      onClick={onClick}
      className="
        w-full text-left p-5 rounded-[var(--radius-lg)]
        bg-[var(--surface)] border border-[var(--border-soft)]
        shadow-[var(--shadow)] backdrop-blur-lg
        transition-all duration-[var(--motion-base)]
        hover:bg-[var(--surface-strong)] hover:scale-[1.02]
        active:scale-[0.98] cursor-pointer
        flex flex-col gap-3
      "
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div
            className="w-3 h-3 rounded-full mb-2"
            style={{ backgroundColor: course.coverColor }}
          />
          <h3 className="text-base font-semibold text-[var(--text-main)] truncate">
            {course.title}
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-1 line-clamp-2">
            {course.description}
          </p>
        </div>
        <ProgressRing value={progress} size={44} strokeWidth={3} label={`${Math.round(progress * 100)}%`} />
      </div>

      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <span className="uppercase tracking-wider font-medium">
          {course.language.target.toUpperCase()} / {course.language.native.toUpperCase()}
        </span>
        <span className="opacity-40">|</span>
        <span>{lessonsCompleted}/{totalLessons} lecciones</span>
      </div>
    </button>
  )
}

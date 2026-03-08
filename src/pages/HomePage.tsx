import { useNavigate } from 'react-router-dom'
import { useContentStore } from '@/stores/useContentStore'
import { useProgressStore } from '@/stores/useProgressStore'
import { ProgressRing } from '@/components/ProgressRing'
import { Button } from '@/components/ui/Button'
import { UiIcon } from '@/components/ui/Icons'
import type { Chapter } from '@/types'

interface LevelCardProps {
  chapter: Chapter
  levelNum: number
  lessonsLoaded: number
  completedCount: number
  progress: number
  onClick: () => void
}

function LevelCard({ chapter, levelNum, lessonsLoaded, completedCount, progress, onClick }: LevelCardProps) {
  const totalDisplay = lessonsLoaded > 0 ? lessonsLoaded : chapter.totalSections
  const pct = Math.round(progress * 100)

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
      <div className="flex items-center gap-4">
        <div className="
          w-10 h-10 rounded-full flex items-center justify-center shrink-0
          text-xs font-bold
          bg-[var(--surface-strong)] text-[var(--text-muted)] border border-[var(--border-soft)]
        ">
          {levelNum}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text-main)] truncate">
            {chapter.title}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Nivel {levelNum}
          </p>
        </div>

        <UiIcon name="chevron" size={18} className="text-[var(--text-muted)] shrink-0" />
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-[var(--text-muted)]">
            {completedCount}/{totalDisplay} secciones
          </span>
          <span className={`text-xs font-medium ${progress >= 1 ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
            {progress >= 1 ? 'Completado' : `${pct}%`}
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[var(--surface-strong)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </button>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const courses = useContentStore((s) => s.courses)
  const lessonsByChapter = useContentStore((s) => s.lessonsByChapter)
  const lessonProgress = useProgressStore((s) => s.lessonProgress)

  const course = courses[0]
  if (!course) return null

  const chapters = course.chapters ?? []

  const allLessonsCount = chapters.reduce((sum, ch) => sum + (lessonsByChapter[ch.id]?.length ?? 0), 0)
  const completedTotal = Object.values(lessonProgress).filter(
    (p) => p.courseId === course.id && p.status === 'completed',
  ).length
  const overallProgress = allLessonsCount > 0 ? completedTotal / allLessonsCount : 0

  return (
    <div className="app-shell min-h-dvh">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 fade-in"
        style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}
      >
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-[var(--text-muted)] font-medium mb-1">
                Practica de idiomas
              </p>
              <h1 className="text-2xl font-bold font-[var(--font-display)] text-[var(--text-main)]"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                JALECO
              </h1>
            </div>
            <Button variant="icon" size="sm" onClick={() => navigate('/settings')} aria-label="Ajustes">
              <UiIcon name="settings" size={22} />
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-main)]">{course.title}</h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{chapters.length} capitulos</p>
            </div>
            <ProgressRing value={overallProgress} size={44} strokeWidth={3} label={`${Math.round(overallProgress * 100)}%`} />
          </div>
        </header>

        {/* Chapter levels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {chapters.map((chapter, idx) => {
            const lessons = lessonsByChapter[chapter.id] ?? []
            const chCompleted = lessons.filter((l) => {
              const key = `${course.id}/${chapter.id}/${l.lesson.id}`
              return lessonProgress[key]?.status === 'completed'
            }).length
            const chProgress = lessons.length > 0 ? chCompleted / lessons.length : 0
            return (
              <LevelCard
                key={chapter.id}
                chapter={chapter}
                levelNum={idx + 1}
                lessonsLoaded={lessons.length}
                completedCount={chCompleted}
                progress={chProgress}
                onClick={() => navigate(`/course/${course.id}/chapter/${chapter.id}`)}
              />
            )
          })}
        </div>

        {chapters.length === 0 && (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <p>Este curso no tiene capitulos todavia.</p>
          </div>
        )}
      </div>
    </div>
  )
}

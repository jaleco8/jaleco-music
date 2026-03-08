import { useParams, useNavigate } from 'react-router-dom'
import { useContentStore } from '@/stores/useContentStore'
import { useProgressStore } from '@/stores/useProgressStore'
import { LessonCard } from '@/components/LessonCard'
import { ProgressRing } from '@/components/ProgressRing'
import { Button } from '@/components/ui/Button'
import { UiIcon } from '@/components/ui/Icons'

export default function ChapterPage() {
  const { courseId, chapterId } = useParams<{ courseId: string; chapterId: string }>()
  const navigate = useNavigate()
  const courses = useContentStore((s) => s.courses)
  const lessonsByChapter = useContentStore((s) => s.lessonsByChapter)
  const setActiveCourse = useContentStore((s) => s.setActiveCourse)
  const setActiveLesson = useContentStore((s) => s.setActiveLesson)
  const lessonProgress = useProgressStore((s) => s.lessonProgress)

  const course = courses.find((c) => c.id === courseId)
  const chapter = course?.chapters?.find((ch) => ch.id === chapterId)
  const lessons = chapterId ? (lessonsByChapter[chapterId] ?? []) : []

  if (!course || !courseId || !chapter || !chapterId) {
    return (
      <div className="app-shell min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[var(--text-main)] mb-2">Capítulo no encontrado</h2>
          <Button variant="ghost" onClick={() => navigate(courseId ? `/course/${courseId}` : '/')}>
            Volver
          </Button>
        </div>
      </div>
    )
  }

  const completedCount = lessons.filter((l) => {
    const key = `${courseId}/${chapterId}/${l.lesson.id}`
    return lessonProgress[key]?.status === 'completed'
  }).length
  const progress = lessons.length > 0 ? completedCount / lessons.length : 0

  const handleLessonClick = (lessonId: string) => {
    setActiveCourse(courseId)
    setActiveLesson(lessonId)
    navigate(`/course/${courseId}/chapter/${chapterId}/lesson/${lessonId}/prep`)
  }

  return (
    <div className="app-shell min-h-dvh">
      <div
        className="max-w-2xl mx-auto px-4 py-6 pb-24 fade-in"
        style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}
      >
        {/* Header */}
        <header className="mb-8">
          <Button
            variant="icon"
            size="sm"
            onClick={() => navigate(`/course/${courseId}`)}
            className="mb-4 -ml-2"
            aria-label="Volver"
          >
            <UiIcon name="back" size={20} />
            <span className="text-sm">{course.title}</span>
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div
                className="w-3 h-3 rounded-full mb-2"
                style={{ backgroundColor: course.coverColor }}
              />
              <h1 className="text-xl font-bold text-[var(--text-main)]">{chapter.title}</h1>
            </div>
            <ProgressRing value={progress} size={56} strokeWidth={4} label={`${Math.round(progress * 100)}%`} />
          </div>

          <div className="flex items-center gap-2 mt-3 text-xs text-[var(--text-muted)]">
            <span>{completedCount}/{lessons.length} lecciones completadas</span>
          </div>
        </header>

        {/* Lesson list */}
        <div className="flex flex-col gap-2">
          {lessons.map((l) => {
            const key = `${courseId}/${chapterId}/${l.lesson.id}`
            return (
              <LessonCard
                key={l.lesson.id}
                lesson={l.lesson}
                progress={lessonProgress[key]}
                onClick={() => handleLessonClick(l.lesson.id)}
              />
            )
          })}
        </div>

        {lessons.length === 0 && (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <p>Este capítulo no tiene lecciones todavía.</p>
          </div>
        )}
      </div>
    </div>
  )
}

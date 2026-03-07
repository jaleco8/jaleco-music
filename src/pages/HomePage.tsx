import { useNavigate } from 'react-router-dom'
import { useContentStore } from '@/stores/useContentStore'
import { useProgressStore } from '@/stores/useProgressStore'
import { CourseCard } from '@/components/CourseCard'
import { ContentLoader } from '@/components/ContentLoader'
import { Button } from '@/components/ui/Button'
import { UiIcon } from '@/components/ui/Icons'

export default function HomePage() {
  const navigate = useNavigate()
  const courses = useContentStore((s) => s.courses)
  const lessonsByCourse = useContentStore((s) => s.lessonsByCourse)
  const lessonProgress = useProgressStore((s) => s.lessonProgress)

  const getCourseStats = (courseId: string) => {
    const lessons = lessonsByCourse[courseId] ?? []
    const totalLessons = lessons.length
    let completed = 0
    for (const l of lessons) {
      const fullId = `${courseId}/${l.lesson.id}`
      if (lessonProgress[fullId]?.status === 'completed') completed++
    }
    return {
      totalLessons,
      lessonsCompleted: completed,
      progress: totalLessons > 0 ? completed / totalLessons : 0,
    }
  }

  return (
    <div className="app-shell min-h-dvh">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 fade-in"
        style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}
      >
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
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
        </header>

        {/* Empty state */}
        {courses.length === 0 && (
          <div className="
            flex flex-col items-center justify-center gap-6 py-20
            text-center
          ">
            <div className="
              w-20 h-20 rounded-full
              bg-[var(--accent-soft)] flex items-center justify-center
            ">
              <UiIcon name="folder" size={36} className="text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-main)] mb-2">
                Empieza cargando un curso
              </h2>
              <p className="text-sm text-[var(--text-muted)] max-w-xs mx-auto">
                Selecciona una carpeta con tus lecciones organizadas para comenzar a practicar.
              </p>
            </div>
            <ContentLoader />
          </div>
        )}

        {/* Course grid */}
        {courses.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {courses.map((course) => {
                const stats = getCourseStats(course.id)
                return (
                  <CourseCard
                    key={course.id}
                    course={course}
                    progress={stats.progress}
                    lessonsCompleted={stats.lessonsCompleted}
                    totalLessons={stats.totalLessons}
                    onClick={() => navigate(`/course/${course.id}`)}
                  />
                )
              })}
            </div>

            <div className="flex justify-center">
              <ContentLoader />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

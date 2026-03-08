import { create } from 'zustand'
import type { Course } from '@/types'
import { getCourse, getLessonsByCourse, getLessonsByChapter } from '@/lib/contentLoader'
import type { LessonData } from '@/lib/contentLoader'

interface ContentState {
  courses: Course[]
  lessonsByCourse: Record<string, LessonData[]>
  lessonsByChapter: Record<string, LessonData[]>
  activeCourseId: string | null
  activeLessonId: string | null

  /* Actions */
  setActiveCourse: (courseId: string | null) => void
  setActiveLesson: (lessonId: string | null) => void
  removeCourse: (courseId: string) => void
  getActiveLesson: () => LessonData | null
  getCourseLessons: (courseId: string) => LessonData[]
}

export const useContentStore = create<ContentState>()(
  (set, get) => ({
    courses: [getCourse()],
    lessonsByCourse: getLessonsByCourse(),
    lessonsByChapter: getLessonsByChapter(),
    activeCourseId: null,
    activeLessonId: null,

    setActiveCourse: (courseId) => set({ activeCourseId: courseId }),
    setActiveLesson: (lessonId) => set({ activeLessonId: lessonId }),

    removeCourse: (courseId) =>
      set((state) => {
        const newLessons = { ...state.lessonsByCourse }
        delete newLessons[courseId]
        return {
          courses: state.courses.filter((c) => c.id !== courseId),
          lessonsByCourse: newLessons,
          activeCourseId: state.activeCourseId === courseId ? null : state.activeCourseId,
          activeLessonId: state.activeCourseId === courseId ? null : state.activeLessonId,
        }
      }),

    getActiveLesson: () => {
      const { activeCourseId, activeLessonId, lessonsByCourse } = get()
      if (!activeCourseId || !activeLessonId) return null
      const lessons = lessonsByCourse[activeCourseId]
      if (!lessons) return null
      return lessons.find((l) => l.lesson.id === activeLessonId) ?? null
    },

    getCourseLessons: (courseId) => {
      return get().lessonsByCourse[courseId] ?? []
    },
  }),
)

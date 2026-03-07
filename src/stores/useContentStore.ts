import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Course, Lesson, CueDraft } from '@/types'
import { parseCourseFolder, parseCourseFromFileList } from '@/lib/contentParser'

interface LessonData {
  lesson: Lesson
  cues: CueDraft[]
  audioNormalUrl: string | null
  audioInteractiveUrl: string | null
}

interface ContentState {
  courses: Course[]
  lessonsByCourse: Record<string, LessonData[]>
  activeCourseId: string | null
  activeLessonId: string | null
  loading: boolean
  error: string | null

  /* Actions */
  loadCourseFromDirectory: (dirHandle: FileSystemDirectoryHandle) => Promise<void>
  loadCourseFromFileList: (files: FileList) => Promise<void>
  setActiveCourse: (courseId: string | null) => void
  setActiveLesson: (lessonId: string | null) => void
  removeCourse: (courseId: string) => void
  getActiveLesson: () => LessonData | null
  getCourseLessons: (courseId: string) => LessonData[]
}

export const useContentStore = create<ContentState>()(
  persist(
    (set, get) => ({
      courses: [],
      lessonsByCourse: {},
      activeCourseId: null,
      activeLessonId: null,
      loading: false,
      error: null,

      loadCourseFromDirectory: async (dirHandle) => {
        set({ loading: true, error: null })
        try {
          const { course, lessons } = await parseCourseFolder(dirHandle)

          set((state) => {
            // Replace if course already exists
            const filteredCourses = state.courses.filter((c) => c.id !== course.id)
            const newLessons = { ...state.lessonsByCourse }
            newLessons[course.id] = lessons.map((l) => ({
              lesson: l.lesson,
              cues: l.cues,
              audioNormalUrl: l.audioNormalUrl,
              audioInteractiveUrl: l.audioInteractiveUrl,
            }))

            return {
              courses: [...filteredCourses, course],
              lessonsByCourse: newLessons,
              loading: false,
            }
          })
        } catch (err) {
          set({ error: (err as Error).message, loading: false })
        }
      },

      loadCourseFromFileList: async (files) => {
        set({ loading: true, error: null })
        try {
          const { course, lessons } = await parseCourseFromFileList(files)

          set((state) => {
            const filteredCourses = state.courses.filter((c) => c.id !== course.id)
            const newLessons = { ...state.lessonsByCourse }
            newLessons[course.id] = lessons.map((l) => ({
              lesson: l.lesson,
              cues: l.cues,
              audioNormalUrl: l.audioNormalUrl,
              audioInteractiveUrl: l.audioInteractiveUrl,
            }))

            return {
              courses: [...filteredCourses, course],
              lessonsByCourse: newLessons,
              loading: false,
            }
          })
        } catch (err) {
          set({ error: (err as Error).message, loading: false })
        }
      },

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
    {
      name: 'jaleco-content',
      partialize: (state) => ({
        courses: state.courses,
        // Don't persist audio URLs or cues — they are object URLs that expire
      }),
    },
  ),
)

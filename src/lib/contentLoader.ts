import courseData from '@/content/courses/english-beginner/course.json'

const lessonModules = import.meta.glob(
  '@/content/courses/**/lesson.json',
  { eager: true }
)

export type Lesson = {
  id: string
  title: string
  chapterId: string
  order: number
  estimatedMinutes: number
  tags: string[]
  audioNormal: string
  audioInteractive: string
  textFile: string
  defaultRepeatTarget: number
  defaultSpeed: number
}

export type Course = typeof courseData

export function getCourse(): Course {
  return courseData
}

export function getAllLessons(): Lesson[] {
  return Object.values(lessonModules).map(
    (mod) => (mod as { default: Lesson }).default
  )
}

export function getLessonsByChapter(chapterId: string): Lesson[] {
  return getAllLessons()
    .filter((l) => l.chapterId === chapterId)
    .sort((a, b) => a.order - b.order)
}

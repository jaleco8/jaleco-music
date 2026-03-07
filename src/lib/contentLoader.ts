import courseData from '@/content/courses/english-beginner/course.json'
import type { Course, Lesson, CueDraft } from '@/types'
import { buildCueDrafts } from './cueBuilder'

/* ── Build-time imports via Vite globs ── */

const lessonModules = import.meta.glob<{ default: Lesson }>(
  '@/content/courses/**/lesson.json',
  { eager: true },
)

const textModules = import.meta.glob<string>(
  '@/content/courses/**/text.txt',
  { eager: true, query: '?raw', import: 'default' },
)

const audioModules = import.meta.glob<string>(
  '@/content/courses/**/*.mp3',
  { eager: true, query: '?url', import: 'default' },
)

/* ── Types ── */

export interface LessonData {
  lesson: Lesson
  cues: CueDraft[]
  audioNormalUrl: string | null
  audioInteractiveUrl: string | null
}

/* ── Helpers ── */

/** Extract the directory path from a module key */
function dirOf(key: string): string {
  return key.slice(0, key.lastIndexOf('/'))
}

/* ── Public API ── */

export function getCourse(): Course {
  const chapters = courseData.chapters ?? []
  return {
    id: courseData.id,
    title: courseData.title,
    description: courseData.description,
    language: courseData.language,
    coverColor: courseData.coverColor,
    totalUnits: chapters.reduce(
      (sum: number, ch: { totalSections?: number }) => sum + (ch.totalSections ?? 0),
      0,
    ),
  }
}

export function getAllLessons(): LessonData[] {
  return Object.entries(lessonModules).map(([key, mod]) => {
    const lesson = mod.default
    const dir = dirOf(key)

    // Resolve text.txt in the same directory
    const textKey = `${dir}/${lesson.textFile ?? 'text.txt'}`
    const rawText = textModules[textKey] ?? null
    const cues = rawText ? buildCueDrafts(rawText, true) : []

    // Resolve audio files in the same directory
    const normalKey = `${dir}/${lesson.audioNormal ?? 'audio-normal.mp3'}`
    const interactiveKey = `${dir}/${lesson.audioInteractive ?? 'audio-interactive.mp3'}`

    return {
      lesson,
      cues,
      audioNormalUrl: audioModules[normalKey] ?? null,
      audioInteractiveUrl: audioModules[interactiveKey] ?? null,
    }
  }).sort((a, b) => a.lesson.order - b.lesson.order)
}

export function getLessonsByCourse(): Record<string, LessonData[]> {
  const all = getAllLessons()
  return { [courseData.id]: all }
}

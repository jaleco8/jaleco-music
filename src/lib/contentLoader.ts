import courseData from '@/content/courses/english-beginner/course.json'
import type { Course, Lesson, CueDraft } from '@/types'
import { buildCueDrafts } from './cueBuilder'
import { parseVttStarts } from './timingEngine'

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

const vttModules = import.meta.glob<string>(
  '@/content/courses/**/*.vtt',
  { eager: true, query: '?raw', import: 'default' },
)

/* ── Types ── */

export interface LessonData {
  lesson: Lesson
  cues: CueDraft[]
  audioNormalUrl: string | null
  audioInteractiveUrl: string | null
  /** Start times (seconds) loaded from timing-normal.vtt, if it exists */
  timingNormal: number[] | null
  /** Start times (seconds) loaded from timing-interactive.vtt, if it exists */
  timingInteractive: number[] | null
  /**
   * Path relative to src/content/courses/, e.g.
   * "english-beginner/cap01-interactive-stories/section-01-presenting-yourself"
   * Used by the timing editor to write VTT files back to the source tree.
   */
  contentRelativePath: string
}

/* ── Helpers ── */

/** Extract the directory path from a module key */
function dirOf(key: string): string {
  return key.slice(0, key.lastIndexOf('/'))
}

/**
 * Strips the Vite glob prefix to get a path relative to src/content/courses/.
 * Glob keys look like "/src/content/courses/english-beginner/.../section-01/lesson.json"
 */
function courseRelativeDir(globKey: string): string {
  const dir = dirOf(globKey)
  const marker = '/content/courses/'
  const idx = dir.indexOf(marker)
  return idx >= 0 ? dir.slice(idx + marker.length) : dir
}

/**
 * Extract chapterId from contentRelativePath:
 * "english-beginner/cap01-interactive-stories/section-01-presenting-yourself"
 * -> "cap01-interactive-stories"
 */
function chapterIdFromContentPath(contentRelativePath: string): string | null {
  const parts = contentRelativePath.split('/')
  return parts[1] ?? null
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
    chapters: chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      totalSections: ch.totalSections ?? 0,
    })),
  }
}

export function getLessonsByChapter(): Record<string, LessonData[]> {
  const result: Record<string, LessonData[]> = {}
  for (const item of getAllLessons()) {
    const chapterId = chapterIdFromContentPath(item.contentRelativePath)
    if (!chapterId) continue
    if (!result[chapterId]) result[chapterId] = []
    result[chapterId].push(item)
  }
  return result
}

export function getAllLessons(): LessonData[] {
  return Object.entries(lessonModules).map(([key, mod]) => {
    const lesson = mod.default
    const dir = dirOf(key)
    const contentRelativePath = courseRelativeDir(key)

    // Resolve text.txt in the same directory
    const textKey = `${dir}/${lesson.textFile ?? 'text.txt'}`
    const rawText = textModules[textKey] ?? null
    const cues = rawText ? buildCueDrafts(rawText, true) : []

    // Resolve audio files in the same directory
    const normalKey = `${dir}/${lesson.audioNormal ?? 'audio-normal.mp3'}`
    const interactiveKey = `${dir}/${lesson.audioInteractive ?? 'audio-interactive.mp3'}`

    // Resolve optional timing VTT files
    const normalVttKey = `${dir}/timing-normal.vtt`
    const interactiveVttKey = `${dir}/timing-interactive.vtt`
    const timingNormal = vttModules[normalVttKey]
      ? parseVttStarts(vttModules[normalVttKey])
      : null
    const timingInteractive = vttModules[interactiveVttKey]
      ? parseVttStarts(vttModules[interactiveVttKey])
      : null

    return {
      lesson,
      cues,
      audioNormalUrl: audioModules[normalKey] ?? null,
      audioInteractiveUrl: audioModules[interactiveKey] ?? null,
      timingNormal,
      timingInteractive,
      contentRelativePath,
    }
  }).sort((a, b) => a.lesson.order - b.lesson.order)
}

export function getLessonsByCourse(): Record<string, LessonData[]> {
  const all = getAllLessons()

  // Some courses mirror chapters and repeat the same lesson order in each one.
  // Keep a single lesson per order to avoid duplicate cards in the course list.
  // When two chapters share the same order, prefer whichever chapter appears
  // first in course.json.
  const chapterOrder = new Map(
    (courseData.chapters ?? []).map((chapter, index) => [chapter.id, index] as const),
  )

  const byLessonSlot = new Map<string, LessonData>()
  for (const item of all) {
    const slotKey = Number.isFinite(item.lesson.order)
      ? `order:${item.lesson.order}`
      : `id:${item.lesson.id}`

    const existing = byLessonSlot.get(slotKey)
    if (!existing) {
      byLessonSlot.set(slotKey, item)
      continue
    }

    const itemChapter = chapterIdFromContentPath(item.contentRelativePath)
    const existingChapter = chapterIdFromContentPath(existing.contentRelativePath)
    const itemChapterOrder = itemChapter ? (chapterOrder.get(itemChapter) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
    const existingChapterOrder = existingChapter ? (chapterOrder.get(existingChapter) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER

    if (itemChapterOrder < existingChapterOrder) {
      byLessonSlot.set(slotKey, item)
    }
  }

  const deduped = Array.from(byLessonSlot.values())
    .sort((a, b) => a.lesson.order - b.lesson.order)

  return { [courseData.id]: deduped }
}

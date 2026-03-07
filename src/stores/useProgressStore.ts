import { create } from 'zustand'
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval'
import type { LessonProgress } from '@/types'

const PROGRESS_PREFIX = 'progress:'

interface ProgressState {
  lessonProgress: Record<string, LessonProgress>
  hydrated: boolean

  /* Actions */
  loadAllProgress: () => Promise<void>
  getLessonProgress: (lessonId: string) => LessonProgress | undefined
  updateLessonProgress: (lessonId: string, update: Partial<LessonProgress>) => Promise<void>
  recordLoopCompletion: (lessonId: string, courseId: string, repeatTarget: number) => Promise<void>
  recordPracticeTime: (lessonId: string, courseId: string, seconds: number) => Promise<void>
  clearAllProgress: () => Promise<void>
  getCourseCompletionRatio: (courseId: string, lessonIds: string[]) => number
}

function createDefaultProgress(lessonId: string, courseId: string): LessonProgress {
  return {
    lessonId,
    courseId,
    completedLoops: 0,
    bestStreak: 0,
    lastPracticedAt: new Date().toISOString(),
    totalTimeSeconds: 0,
    status: 'not-started',
  }
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  lessonProgress: {},
  hydrated: false,

  loadAllProgress: async () => {
    try {
      const allKeys = await idbKeys()
      const progressKeys = (allKeys as string[]).filter((k) => k.startsWith(PROGRESS_PREFIX))
      const entries: Record<string, LessonProgress> = {}

      await Promise.all(
        progressKeys.map(async (key) => {
          const value = await idbGet<LessonProgress>(key)
          if (value) {
            const lessonId = key.slice(PROGRESS_PREFIX.length)
            entries[lessonId] = value
          }
        }),
      )

      set({ lessonProgress: entries, hydrated: true })
    } catch {
      set({ hydrated: true })
    }
  },

  getLessonProgress: (lessonId) => {
    return get().lessonProgress[lessonId]
  },

  updateLessonProgress: async (lessonId, update) => {
    const current = get().lessonProgress[lessonId]
    const updated: LessonProgress = { ...current!, ...update, lessonId }

    set((state) => ({
      lessonProgress: { ...state.lessonProgress, [lessonId]: updated },
    }))

    await idbSet(`${PROGRESS_PREFIX}${lessonId}`, updated)
  },

  recordLoopCompletion: async (lessonId, courseId, repeatTarget) => {
    const current = get().lessonProgress[lessonId] ?? createDefaultProgress(lessonId, courseId)
    const newLoops = current.completedLoops + 1
    const newStreak = Math.max(current.bestStreak, newLoops)
    const isComplete = newLoops >= repeatTarget

    const updated: LessonProgress = {
      ...current,
      completedLoops: newLoops,
      bestStreak: newStreak,
      lastPracticedAt: new Date().toISOString(),
      status: isComplete ? 'completed' : 'in-progress',
    }

    set((state) => ({
      lessonProgress: { ...state.lessonProgress, [lessonId]: updated },
    }))

    await idbSet(`${PROGRESS_PREFIX}${lessonId}`, updated)
  },

  recordPracticeTime: async (lessonId, courseId, seconds) => {
    const current = get().lessonProgress[lessonId] ?? createDefaultProgress(lessonId, courseId)
    const updated: LessonProgress = {
      ...current,
      totalTimeSeconds: current.totalTimeSeconds + seconds,
      lastPracticedAt: new Date().toISOString(),
      status: current.status === 'not-started' ? 'in-progress' : current.status,
    }

    set((state) => ({
      lessonProgress: { ...state.lessonProgress, [lessonId]: updated },
    }))

    await idbSet(`${PROGRESS_PREFIX}${lessonId}`, updated)
  },

  clearAllProgress: async () => {
    const allKeys = await idbKeys()
    const progressKeys = (allKeys as string[]).filter((k) => k.startsWith(PROGRESS_PREFIX))
    await Promise.all(progressKeys.map((key) => idbDel(key)))
    set({ lessonProgress: {} })
  },

  getCourseCompletionRatio: (courseId, lessonIds) => {
    const progress = get().lessonProgress
    const completed = lessonIds.filter((id) => {
      const fullId = `${courseId}/${id}`
      return progress[fullId]?.status === 'completed'
    }).length
    return lessonIds.length > 0 ? completed / lessonIds.length : 0
  },
}))

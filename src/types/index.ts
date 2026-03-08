/* ── Cue System ── */
export type CueKind = 'statement' | 'question'

export type Cue = {
  id: string
  text: string
  translation?: string
  kind: CueKind
  start: number
  end: number
  duration: number
  weight: number
}

export type CueDraft = Pick<Cue, 'text' | 'translation' | 'kind'>

/* ── Playback ── */
export type PlaybackStatus = 'stopped' | 'countdown' | 'playing' | 'paused' | 'exploring'
export type RepeatTarget = 5 | 10 | 20 | 30 | 40 | 'inf'

/* ── Study ── */
export type StudyMode = 'with-translation' | 'without-translation' | 'interactive'
export type AudioMode = 'normal' | 'interactive'
export type SyncMode = 'auto' | 'manual'

/* ── Display ── */
export type LineSpacing = 'compact' | 'normal' | 'relaxed'

/* ── Presets ── */
export type PresetKey = 'quick-start' | 'without-translation' | 'blind' | 'interactive'

export type PresetConfig = {
  studyMode: StudyMode
  blindMode: boolean
  playbackRate: number
  repeatTarget: RepeatTarget
  focusMode?: boolean
  countdownEnabled?: boolean
}

/* ── Gestures ── */
export type GestureMode = 'idle' | 'pending' | 'horizontal' | 'vertical'

export type GestureState = {
  pointerId: number | null
  startX: number
  startY: number
  startPlayhead: number
  startFontLevel: number
  mode: GestureMode
  moved: boolean
}

/* ── UI ── */
export type LivePanel = 'speed' | 'repeat' | 'more' | null
export type UiToastTone = 'info' | 'success' | 'warning' | 'error'

/* ── Content (folder-based) ── */
export interface Chapter {
  id: string
  title: string
  totalSections: number
}

export interface Course {
  id: string
  title: string
  description: string
  language: { target: string; native: string }
  coverColor: string
  totalUnits: number
  chapters?: Chapter[]
}

export interface Lesson {
  id: string
  title: string
  order: number
  estimatedMinutes: number
  tags: string[]
  audioNormal: string
  audioInteractive: string
  textFile: string
  defaultRepeatTarget: RepeatTarget
  defaultSpeed: number
}

export interface LoadedLesson extends Lesson {
  cues: CueDraft[]
  audioNormalUrl: string | null
  audioInteractiveUrl: string | null
}

/* ── Progress (IndexedDB) ── */
export interface LessonProgress {
  lessonId: string
  courseId: string
  completedLoops: number
  bestStreak: number
  lastPracticedAt: string
  totalTimeSeconds: number
  status: 'not-started' | 'in-progress' | 'completed'
}

export interface CourseProgress {
  courseId: string
  lessonsCompleted: number
  totalLessons: number
  lastAccessedAt: string
}

/* ── Constants ── */
export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const
export const REPEAT_OPTIONS: RepeatTarget[] = [5, 10, 20, 30, 40, 'inf']
export const FONT_LEVELS = [30, 36, 44, 52]
export const PREVIEW_FONT_LEVELS = [18, 22, 26, 30]

export const LINE_HEIGHTS: Record<LineSpacing, number> = {
  compact: 1.18,
  normal: 1.36,
  relaxed: 1.56,
}

export const MIN_CUE_GAP_SEC = 0.05
export const LIVE_FOCUS_POINT = 0.42
export const DOUBLE_TAP_MS = 280
export const HIDE_CONTROLS_MS = 2600
export const KEYBOARD_VOLUME_STEP = 0.05

export const MODE_HELP: Record<StudyMode | 'blind', string> = {
  'with-translation': 'Muestra original y traduccion para entrar rapido en contexto.',
  'without-translation': 'Oculta traduccion para forzar comprension directa.',
  interactive: 'Resalta preguntas para practicar respuesta en voz alta.',
  blind: 'Difumina el texto y prioriza entrenamiento auditivo.',
}

export const PRESET_LABELS: Record<PresetKey, string> = {
  'quick-start': 'Repaso rapido',
  'without-translation': 'Reto mental',
  blind: 'Inmersion auditiva',
  interactive: 'Practica oral',
}

export const PRESET_CONFIGS: Record<PresetKey, PresetConfig> = {
  'quick-start': {
    studyMode: 'with-translation',
    blindMode: false,
    playbackRate: 1,
    repeatTarget: 10,
    focusMode: true,
    countdownEnabled: true,
  },
  'without-translation': {
    studyMode: 'without-translation',
    blindMode: false,
    playbackRate: 1,
    repeatTarget: 20,
  },
  blind: {
    studyMode: 'without-translation',
    blindMode: true,
    playbackRate: 1,
    repeatTarget: 20,
    focusMode: true,
  },
  interactive: {
    studyMode: 'interactive',
    blindMode: false,
    playbackRate: 1,
    repeatTarget: 20,
  },
}

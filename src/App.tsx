import {
  type AriaRole,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './App.css'

type ViewMode = 'prep' | 'live'
type PlaybackStatus = 'stopped' | 'countdown' | 'playing' | 'paused' | 'exploring'
type RepeatTarget = 5 | 10 | 20 | 30 | 40 | 'inf'
type LineSpacing = 'compact' | 'normal' | 'relaxed'
type PrepEditorTab = 'text' | 'timing'
type SyncMode = 'auto' | 'manual'
type GestureMode = 'idle' | 'pending' | 'horizontal' | 'vertical'
type StudyMode = 'with-translation' | 'without-translation' | 'interactive'
type PresetKey = 'quick-start' | 'without-translation' | 'blind' | 'interactive'
type PresetConfig = {
  studyMode: StudyMode
  blindMode: boolean
  playbackRate: number
  repeatTarget: RepeatTarget
  focusMode?: boolean
  countdownEnabled?: boolean
}
type CueKind = 'statement' | 'question'
type Cue = {
  id: string
  text: string
  translation?: string
  start: number
  end: number
  duration: number
  weight: number
}
type CueDraft = Pick<Cue, 'text' | 'translation'>
type PrepPersistedState = {
  lyrics?: string
  pairImportMode?: boolean
  syncMode?: SyncMode
  manualStarts?: number[]
  studyMode?: StudyMode
  blindMode?: boolean
}

type PrepUiSessionState = {
  audioExpanded?: boolean
  advancedExpanded?: boolean
  preset?: PresetKey
  presetModified?: boolean
}

type TapSide = 'left' | 'center' | 'right'

type GestureState = {
  pointerId: number | null
  startX: number
  startY: number
  startPlayhead: number
  startFontLevel: number
  mode: GestureMode
  moved: boolean
}

type FunnelEventName =
  | 'prep_view'
  | 'prep_change_setting'
  | 'prep_click_start_live'
  | 'live_started'
  | 'prep_abandon'
  | 'prep_audio_expand'
  | 'ab_exposure'
  | 'ab_conversion'

type ExperimentKey =
  | 'prep_sticky_footer'
  | 'prep_audio_collapsed'
  | 'prep_quick_presets'
  | 'prep_advanced_settings'
  | 'prep_mode_tooltips'

type ExperimentVariant = 'control' | 'variant'
type ExperimentAssignments = Record<ExperimentKey, ExperimentVariant>

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
  }
}

const SAMPLE_TEXT = `Respira profundo y entra en calma
La voz se alinea con el pulso
Cada frase cae con intención
El ritmo te sostiene
Vuelves al inicio sin perder foco
Aprender se vuelve fluido`

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const
const REPEAT_OPTIONS: RepeatTarget[] = [5, 10, 20, 30, 40, 'inf']
const FONT_LEVELS = [30, 36, 44, 52]
const PREVIEW_FONT_LEVELS = [18, 22, 26, 30]
const LINE_HEIGHTS: Record<LineSpacing, number> = {
  compact: 1.18,
  normal: 1.36,
  relaxed: 1.56,
}

const LIVE_FOCUS_POINT = 0.42
const DOUBLE_TAP_MS = 280
const HIDE_CONTROLS_MS = 2600
const MIN_CUE_GAP_SEC = 0.05
const SHIFT_STEP_SEC = 0.2
const KEYBOARD_VOLUME_STEP = 0.05
const PREP_STORAGE_KEY = 'jaleco-music:prep-sync:v1'
const PREP_UI_SESSION_KEY = 'jaleco-music:prep-ui-session:v1'
const ANALYTICS_USER_KEY = 'jaleco-music:analytics-user:v1'
const AB_ASSIGNMENTS_KEY = 'jaleco-music:ab-assignments:v1'
const AB_EXPOSURE_KEY = 'jaleco-music:ab-exposure:v1'

const MODE_HELP: Record<StudyMode | 'blind', string> = {
  'with-translation': 'Muestra original y traducción para entrar rápido en contexto.',
  'without-translation': 'Oculta traducción para forzar comprensión directa.',
  interactive: 'Resalta preguntas para practicar respuesta en voz alta.',
  blind: 'Difumina el texto y prioriza entrenamiento auditivo.',
}

const PRESET_LABELS: Record<PresetKey, string> = {
  'quick-start': 'Repaso rápido',
  'without-translation': 'Reto mental',
  blind: 'Inmersión auditiva',
  interactive: 'Práctica oral',
}

const PRESET_CONFIGS: Record<PresetKey, PresetConfig> = {
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

const EXPERIMENT_DEFINITIONS: Record<
  ExperimentKey,
  {
    name: string
    primaryMetric: string
    secondaryMetric: string
  }
> = {
  prep_sticky_footer: {
    name: 'Footer sticky de preparación',
    primaryMetric: 'prep_click_start_live',
    secondaryMetric: 'live_started',
  },
  prep_audio_collapsed: {
    name: 'Audio colapsado por defecto',
    primaryMetric: 'prep_audio_expand',
    secondaryMetric: 'prep_click_start_live',
  },
  prep_quick_presets: {
    name: 'Presets de inicio rápido',
    primaryMetric: 'prep_change_setting',
    secondaryMetric: 'live_started',
  },
  prep_advanced_settings: {
    name: 'Ajustes avanzados colapsables',
    primaryMetric: 'prep_change_setting',
    secondaryMetric: 'prep_click_start_live',
  },
  prep_mode_tooltips: {
    name: 'Ayuda contextual de modos',
    primaryMetric: 'prep_change_setting',
    secondaryMetric: 'live_started',
  },
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const splitLines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

const classifyCueText = (text: string): CueKind => {
  const trimmed = text.trim()
  if (!trimmed) {
    return 'statement'
  }

  return /\[YES\/NO\]/i.test(trimmed) || trimmed.endsWith('?') ? 'question' : 'statement'
}

const buildCueDrafts = (text: string, parseByPairs: boolean): CueDraft[] => {
  const lines = splitLines(text)

  if (!parseByPairs) {
    return lines.map((line) => ({ text: line }))
  }

  const drafts: CueDraft[] = []

  for (let index = 0; index < lines.length; index += 2) {
    const english = lines[index]
    if (!english) {
      continue
    }

    const translation = lines[index + 1]
    drafts.push({
      text: english,
      translation: translation ? translation : undefined,
    })
  }

  return drafts
}

const formatTime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

const formatTimeWithCentiseconds = (seconds: number): string => {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const secs = Math.floor(safe % 60)
  const centiseconds = Math.floor((safe - Math.floor(safe)) * 100)
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds
    .toString()
    .padStart(2, '0')}`
}

const parseTimecode = (raw: string): number | null => {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const asSeconds = Number(trimmed.replace(',', '.'))
  if (Number.isFinite(asSeconds)) {
    return asSeconds
  }

  const match = trimmed.match(/^(\d+):([0-5]\d(?:[.,]\d+)?)$/)
  if (!match) {
    return null
  }

  const minutes = Number(match[1])
  const seconds = Number(match[2].replace(',', '.'))
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null
  }

  return minutes * 60 + seconds
}

const formatSubtitleTimestamp = (seconds: number, separator: '.' | ','): string => {
  const safe = Math.max(0, seconds)
  const totalMs = Math.round(safe * 1000)
  const hours = Math.floor(totalMs / 3_600_000)
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000)
  const secs = Math.floor((totalMs % 60_000) / 1000)
  const milliseconds = totalMs % 1000

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}${separator}${milliseconds
    .toString()
    .padStart(3, '0')}`
}

const serializeVtt = (cues: Cue[]): string => {
  const body = cues
    .map((cue) => {
      const start = formatSubtitleTimestamp(cue.start, '.')
      const end = formatSubtitleTimestamp(cue.end, '.')
      const text = cue.translation ? `${cue.text}\n${cue.translation}` : cue.text
      return `${start} --> ${end}\n${text}`
    })
    .join('\n\n')

  return `WEBVTT\n\n${body}\n`
}

const serializeSrt = (cues: Cue[]): string => {
  return `${cues
    .map((cue, index) => {
      const start = formatSubtitleTimestamp(cue.start, ',')
      const end = formatSubtitleTimestamp(cue.end, ',')
      const text = cue.translation ? `${cue.text}\n${cue.translation}` : cue.text
      return `${index + 1}\n${start} --> ${end}\n${text}`
    })
    .join('\n\n')}\n`
}

const downloadTextFile = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

const buildCues = (drafts: CueDraft[], totalDuration?: number): Cue[] => {
  if (drafts.length === 0) {
    return []
  }

  const weights = drafts.map((draft) => Math.max(1, draft.text.split(/\s+/).filter(Boolean).length))

  if (totalDuration && totalDuration > 0) {
    const totalWeight = weights.reduce((sum, value) => sum + value, 0)
    let cursor = 0

    return drafts.map((draft, index) => {
      const duration = (weights[index] / totalWeight) * totalDuration
      const start = cursor
      const end = index === drafts.length - 1 ? totalDuration : start + duration
      cursor = end

      return {
        id: `cue-${index}`,
        text: draft.text,
        translation: draft.translation,
        start,
        end,
        duration: end - start,
        weight: weights[index],
      }
    })
  }

  let cursor = 0

  return drafts.map((draft, index) => {
    const duration = clamp(weights[index] * 0.5, 1.1, 5.4)
    const start = cursor
    const end = start + duration
    cursor = end

    return {
      id: `cue-${index}`,
      text: draft.text,
      translation: draft.translation,
      start,
      end,
      duration,
      weight: weights[index],
    }
  })
}

const sanitizeManualStarts = (
  starts: number[],
  cueCount: number,
  totalDuration: number,
  fallbackStarts: number[],
): number[] => {
  if (cueCount === 0) {
    return []
  }

  const normalized: number[] = []
  const safeDuration = totalDuration > 0 ? totalDuration : cueCount * 2

  for (let index = 0; index < cueCount; index += 1) {
    const fallback =
      fallbackStarts[index] ??
      (cueCount > 1 ? (index / (cueCount - 1)) * safeDuration : 0)
    const source = Number.isFinite(starts[index]) ? starts[index] : fallback
    const min = index === 0 ? 0 : normalized[index - 1] + MIN_CUE_GAP_SEC
    const max = Math.max(min, safeDuration - (cueCount - index - 1) * MIN_CUE_GAP_SEC)
    normalized.push(clamp(source, min, max))
  }

  return normalized
}

const buildManualCues = (drafts: CueDraft[], starts: number[], totalDuration: number): Cue[] => {
  if (drafts.length === 0) {
    return []
  }

  const safeTotalDuration = Math.max(totalDuration, starts[drafts.length - 1] + MIN_CUE_GAP_SEC)
  const weights = drafts.map((draft) => Math.max(1, draft.text.split(/\s+/).filter(Boolean).length))

  return drafts.map((draft, index) => {
    const start = starts[index]
    const targetEnd = index === drafts.length - 1 ? safeTotalDuration : starts[index + 1]
    const end = Math.max(start + MIN_CUE_GAP_SEC, targetEnd)

    return {
      id: `cue-${index}`,
      text: draft.text,
      translation: draft.translation,
      start,
      end,
      duration: end - start,
      weight: weights[index],
    }
  })
}

const isInteractiveTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && Boolean(target.closest('[data-interactive="true"]'))

const isTextEntryTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable || Boolean(target.closest('[contenteditable="true"]'))) {
    return true
  }

  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

const readStorage = (storage: Storage, key: string): string | null => {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

const writeStorage = (storage: Storage, key: string, value: string): void => {
  try {
    storage.setItem(key, value)
  } catch {
    // Ignore storage write errors.
  }
}

const createStableId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const hashString = (input: string): number => {
  let hash = 0

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0
  }

  return Math.abs(hash)
}

const getOrCreateAnalyticsUserId = (): string => {
  if (typeof window === 'undefined') {
    return 'server-render'
  }

  const stored = readStorage(window.localStorage, ANALYTICS_USER_KEY)
  if (stored) {
    return stored
  }

  const next = createStableId()
  writeStorage(window.localStorage, ANALYTICS_USER_KEY, next)
  return next
}

const resolveExperimentAssignments = (userId: string): ExperimentAssignments => {
  if (typeof window === 'undefined') {
    return {
      prep_sticky_footer: 'control',
      prep_audio_collapsed: 'control',
      prep_quick_presets: 'control',
      prep_advanced_settings: 'control',
      prep_mode_tooltips: 'control',
    }
  }

  const fallback = (experiment: ExperimentKey): ExperimentVariant =>
    hashString(`${userId}:${experiment}`) % 2 === 0 ? 'control' : 'variant'

  const raw = readStorage(window.localStorage, AB_ASSIGNMENTS_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        userId?: string
        assignments?: Partial<Record<ExperimentKey, ExperimentVariant>>
      }

      if (parsed.userId === userId && parsed.assignments) {
        return {
          prep_sticky_footer: parsed.assignments.prep_sticky_footer ?? fallback('prep_sticky_footer'),
          prep_audio_collapsed:
            parsed.assignments.prep_audio_collapsed ?? fallback('prep_audio_collapsed'),
          prep_quick_presets:
            parsed.assignments.prep_quick_presets ?? fallback('prep_quick_presets'),
          prep_advanced_settings:
            parsed.assignments.prep_advanced_settings ?? fallback('prep_advanced_settings'),
          prep_mode_tooltips:
            parsed.assignments.prep_mode_tooltips ?? fallback('prep_mode_tooltips'),
        }
      }
    } catch {
      // Ignore malformed assignment payloads.
    }
  }

  const computed: ExperimentAssignments = {
    prep_sticky_footer: fallback('prep_sticky_footer'),
    prep_audio_collapsed: fallback('prep_audio_collapsed'),
    prep_quick_presets: fallback('prep_quick_presets'),
    prep_advanced_settings: fallback('prep_advanced_settings'),
    prep_mode_tooltips: fallback('prep_mode_tooltips'),
  }

  writeStorage(
    window.localStorage,
    AB_ASSIGNMENTS_KEY,
    JSON.stringify({ userId, assignments: computed }),
  )

  return computed
}

type ChipSelectableProps = {
  selected: boolean
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  role?: AriaRole
  ariaChecked?: boolean
  ariaSelected?: boolean
  ariaPressed?: boolean
  ariaExpanded?: boolean
  ariaControls?: string
  ariaLabel?: string
  ariaDescribedBy?: string
  title?: string
  dataHelp?: string
  className?: string
  type?: 'button' | 'submit' | 'reset'
  dataInteractive?: boolean
}

type IconName = 'chevron' | 'play' | 'speaker' | 'settings'

const UiIcon = ({ name, className }: { name: IconName; className?: string }) => {
  const classes = ['ui-icon', className].filter(Boolean).join(' ')

  if (name === 'chevron') {
    return (
      <svg
        className={classes}
        viewBox="0 0 16 16"
        aria-hidden="true"
        focusable="false"
        fill="none"
      >
        <path d="M3.5 6.25 8 10.5l4.5-4.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (name === 'play') {
    return (
      <svg
        className={classes}
        viewBox="0 0 16 16"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M5 3.5v9l7-4.5-7-4.5Z" fill="currentColor" />
      </svg>
    )
  }

  if (name === 'speaker') {
    return (
      <svg
        className={classes}
        viewBox="0 0 16 16"
        aria-hidden="true"
        focusable="false"
        fill="none"
      >
        <path
          d="M2.3 9.8h2.2L8 12.6V3.4L4.5 6.2H2.3zM10.2 6.1a2.6 2.6 0 0 1 0 3.8M11.9 4.5a4.8 4.8 0 0 1 0 7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg
      className={classes}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      <path
        d="m8 2.1 1 .2.5 1.4 1.4.4 1.2-.8.8.8-.8 1.2.4 1.4 1.4.5.2 1-.2 1-1.4.5-.4 1.4.8 1.2-.8.8-1.2-.8-1.4.4-.5 1.4-1 .2-1-.2-.5-1.4-1.4-.4-1.2.8-.8-.8.8-1.2-.4-1.4-1.4-.5-.2-1 .2-1 1.4-.5.4-1.4-.8-1.2.8-.8 1.2.8 1.4-.4.5-1.4z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

const ChipSelectable = ({
  selected,
  children,
  onClick,
  disabled = false,
  role,
  ariaChecked,
  ariaSelected,
  ariaPressed,
  ariaExpanded,
  ariaControls,
  ariaLabel,
  ariaDescribedBy,
  title,
  dataHelp,
  className,
  type = 'button',
  dataInteractive = true,
}: ChipSelectableProps) => {
  const chipClassName = [selected ? 'chip is-active' : 'chip', className].filter(Boolean).join(' ')

  return (
    <button
      type={type}
      role={role}
      aria-checked={ariaChecked}
      aria-selected={ariaSelected}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      title={title}
      data-help={dataHelp}
      className={chipClassName}
      onClick={onClick}
      disabled={disabled}
      data-interactive={dataInteractive ? 'true' : undefined}
    >
      {children}
    </button>
  )
}

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('prep')
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('stopped')
  const [lyrics, setLyrics] = useState(SAMPLE_TEXT)
  const [pairImportMode, setPairImportMode] = useState(false)
  const [studyMode, setStudyMode] = useState<StudyMode>('without-translation')
  const [blindMode, setBlindMode] = useState(false)
  const [repeatTarget, setRepeatTarget] = useState<RepeatTarget>(20)
  const [playbackRate, setPlaybackRate] = useState<(typeof SPEED_OPTIONS)[number]>(1)
  const [volume, setVolume] = useState(0.85)
  const [fontLevel, setFontLevel] = useState(1)
  const [lineSpacing, setLineSpacing] = useState<LineSpacing>('normal')
  const [darkMode, setDarkMode] = useState(true)
  const [focusMode, setFocusMode] = useState(true)
  const [countdownEnabled, setCountdownEnabled] = useState(true)
  const [hapticEnabled, setHapticEnabled] = useState(true)
  const [playheadSec, setPlayheadSec] = useState(0)
  const [completedLoops, setCompletedLoops] = useState(0)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [volumePanelVisible, setVolumePanelVisible] = useState(false)
  const [countdownValue, setCountdownValue] = useState(0)
  const [loopToast, setLoopToast] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [audioLabel, setAudioLabel] = useState('Sin audio (modo lectura)')
  const [audioDurationSec, setAudioDurationSec] = useState(0)
  const [isAudioExpanded, setIsAudioExpanded] = useState(false)
  const [gestureMessage, setGestureMessage] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [prepEditorTab, setPrepEditorTab] = useState<PrepEditorTab>('text')
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null)
  const [isPresetModified, setIsPresetModified] = useState(false)
  const [syncMode, setSyncMode] = useState<SyncMode>('auto')
  const [manualStarts, setManualStarts] = useState<number[]>([])
  const [timingCursor, setTimingCursor] = useState(0)
  const [timingNotice, setTimingNotice] = useState('')
  const [timeInputDrafts, setTimeInputDrafts] = useState<Record<number, string>>({})
  const [isPrepAudioPlaying, setIsPrepAudioPlaying] = useState(false)
  const [prepStateHydrated, setPrepStateHydrated] = useState(false)
  const analyticsUserId = useMemo(() => getOrCreateAnalyticsUserId(), [])
  const experimentAssignments = useMemo(
    () => resolveExperimentAssignments(analyticsUserId),
    [analyticsUserId],
  )

  const showTranslation = studyMode === 'with-translation'
  const studyModeLabel =
    studyMode === 'with-translation'
      ? 'Con traducción'
      : studyMode === 'without-translation'
        ? 'Sin traducción'
        : 'Interactivo'
  const studyModeHint =
    studyMode === 'with-translation'
      ? 'Original + traducción para arrancar con soporte visual.'
      : studyMode === 'without-translation'
        ? 'Solo original, sin traducción.'
        : 'Interactúa con preguntas y responde en voz alta.'

  const stageRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cueRefs = useRef<Array<HTMLParagraphElement | null>>([])
  const autoScrollFlagRef = useRef(false)
  const hideControlsTimerRef = useRef<number | null>(null)
  const loopToastTimerRef = useRef<number | null>(null)
  const gestureMessageTimerRef = useRef<number | null>(null)
  const timingNoticeTimerRef = useRef<number | null>(null)
  const singleTapTimerRef = useRef<number | null>(null)
  const lastTapRef = useRef<{ time: number; side: TapSide }>({
    time: 0,
    side: 'center',
  })
  const endLockRef = useRef(false)
  const lastActiveCueRef = useRef(-1)
  const prepViewTrackedRef = useRef(false)
  const liveStartedTrackedRef = useRef(false)
  const prepAbandonTrackedRef = useRef(false)
  const exposedExperimentsRef = useRef<Set<ExperimentKey>>(new Set())
  const previousSettingsRef = useRef<Record<string, string | number | boolean | null> | null>(null)

  const gestureStateRef = useRef<GestureState>({
    pointerId: null,
    startX: 0,
    startY: 0,
    startPlayhead: 0,
    startFontLevel: 0,
    mode: 'idle',
    moved: false,
  })

  const cueDrafts = useMemo(() => buildCueDrafts(lyrics, pairImportMode), [lyrics, pairImportMode])

  const autoCues = useMemo(
    () => buildCues(cueDrafts, audioDurationSec > 0 ? audioDurationSec : undefined),
    [audioDurationSec, cueDrafts],
  )

  const autoStarts = useMemo(() => autoCues.map((cue) => cue.start), [autoCues])
  const autoDuration = autoCues.length > 0 ? autoCues[autoCues.length - 1].end : 0
  const syncDurationBase = audioDurationSec > 0 ? audioDurationSec : autoDuration

  const fallbackStarts = useMemo(() => {
    if (autoStarts.length === cueDrafts.length) {
      return autoStarts
    }

    if (cueDrafts.length === 0) {
      return []
    }

    if (cueDrafts.length === 1) {
      return [0]
    }

    const fallbackDuration = syncDurationBase > 0 ? syncDurationBase : cueDrafts.length * 2
    return cueDrafts.map((_, index) => (index / (cueDrafts.length - 1)) * fallbackDuration)
  }, [autoStarts, cueDrafts, syncDurationBase])

  const normalizedManualStarts = useMemo(
    () => sanitizeManualStarts(manualStarts, cueDrafts.length, syncDurationBase, fallbackStarts),
    [cueDrafts.length, fallbackStarts, manualStarts, syncDurationBase],
  )

  const manualCues = useMemo(
    () => buildManualCues(cueDrafts, normalizedManualStarts, syncDurationBase),
    [cueDrafts, normalizedManualStarts, syncDurationBase],
  )

  const cues = useMemo(
    () => (syncMode === 'manual' ? manualCues : autoCues),
    [autoCues, manualCues, syncMode],
  )

  const totalDuration = cues.length > 0 ? cues[cues.length - 1].end : 0
  const cuesForEditor = syncMode === 'manual' ? manualCues : autoCues
  const editorDuration = Math.max(totalDuration, syncDurationBase, 0.1)

  const repeatTargetRef = useRef<RepeatTarget>(repeatTarget)
  const totalDurationRef = useRef(totalDuration)
  const completedLoopsRef = useRef(completedLoops)
  const volumeRef = useRef(volume)

  useEffect(() => {
    repeatTargetRef.current = repeatTarget
  }, [repeatTarget])

  useEffect(() => {
    totalDurationRef.current = totalDuration
  }, [totalDuration])

  useEffect(() => {
    completedLoopsRef.current = completedLoops
  }, [completedLoops])

  useEffect(() => {
    volumeRef.current = volume
  }, [volume])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREP_STORAGE_KEY)
      if (raw) {
        const persisted = JSON.parse(raw) as PrepPersistedState
        if (typeof persisted.lyrics === 'string') {
          setLyrics(persisted.lyrics)
        }
        if (typeof persisted.pairImportMode === 'boolean') {
          setPairImportMode(persisted.pairImportMode)
        }
        if (persisted.syncMode === 'auto' || persisted.syncMode === 'manual') {
          setSyncMode(persisted.syncMode)
        }
        if (
          persisted.studyMode === 'with-translation' ||
          persisted.studyMode === 'without-translation' ||
          persisted.studyMode === 'interactive'
        ) {
          setStudyMode(persisted.studyMode)
        }
        if (typeof persisted.blindMode === 'boolean') {
          setBlindMode(persisted.blindMode)
        }
        if (Array.isArray(persisted.manualStarts)) {
          const starts = persisted.manualStarts
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
          setManualStarts(starts)
        }
      }

      const rawSession = readStorage(window.sessionStorage, PREP_UI_SESSION_KEY)
      if (rawSession) {
        const session = JSON.parse(rawSession) as PrepUiSessionState
        if (typeof session.audioExpanded === 'boolean') {
          setIsAudioExpanded(session.audioExpanded)
        }
        if (typeof session.advancedExpanded === 'boolean') {
          setIsAdvancedOpen(session.advancedExpanded)
        }
        if (
          session.preset === 'quick-start' ||
          session.preset === 'without-translation' ||
          session.preset === 'blind' ||
          session.preset === 'interactive'
        ) {
          setActivePreset(session.preset)
          if (typeof session.presetModified === 'boolean') {
            setIsPresetModified(session.presetModified)
          }
        } else {
          setIsPresetModified(false)
        }
      }
    } catch {
      // Ignore malformed local state and keep defaults.
    } finally {
      setPrepStateHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!prepStateHydrated) {
      return
    }

    const payload: PrepPersistedState = {
      lyrics,
      pairImportMode,
      syncMode,
      manualStarts: normalizedManualStarts,
      studyMode,
      blindMode,
    }

    try {
      window.localStorage.setItem(PREP_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Ignore persistence errors (private mode / storage limits).
    }
  }, [blindMode, lyrics, normalizedManualStarts, pairImportMode, prepStateHydrated, studyMode, syncMode])

  useEffect(() => {
    if (!prepStateHydrated || typeof window === 'undefined') {
      return
    }

    const payload: PrepUiSessionState = {
      audioExpanded: isAudioExpanded,
      advancedExpanded: isAdvancedOpen,
      preset: activePreset ?? undefined,
      presetModified: isPresetModified,
    }

    writeStorage(window.sessionStorage, PREP_UI_SESSION_KEY, JSON.stringify(payload))
  }, [activePreset, isAdvancedOpen, isAudioExpanded, isPresetModified, prepStateHydrated])

  useEffect(() => {
    setTimingCursor((current) => clamp(current, 0, Math.max(cueDrafts.length - 1, 0)))
  }, [cueDrafts.length])

  useEffect(() => {
    setTimeInputDrafts((current) => {
      const filtered = Object.entries(current).filter(([key]) => Number(key) < cueDrafts.length)
      if (filtered.length === Object.keys(current).length) {
        return current
      }

      return Object.fromEntries(filtered) as Record<number, string>
    })
  }, [cueDrafts.length])

  const isActivePlayback = playbackStatus === 'playing' || playbackStatus === 'exploring'

  const activeCueIndex = useMemo(() => {
    if (cues.length === 0) {
      return 0
    }

    const found = cues.findIndex((cue) => playheadSec >= cue.start && playheadSec < cue.end)
    if (found >= 0) {
      return found
    }

    return cues.length - 1
  }, [cues, playheadSec])

  const cueKinds = useMemo(() => cues.map((cue) => classifyCueText(cue.text)), [cues])

  const focusCueIndex = useMemo(() => {
    if (cues.length === 0) {
      return 0
    }

    if (studyMode !== 'interactive') {
      return activeCueIndex
    }

    if (cueKinds[activeCueIndex] === 'question') {
      return activeCueIndex
    }

    const nextQuestionIndex = cueKinds.findIndex(
      (kind, index) => index > activeCueIndex && kind === 'question',
    )
    if (nextQuestionIndex >= 0) {
      return nextQuestionIndex
    }

    return activeCueIndex
  }, [activeCueIndex, cueKinds, cues.length, studyMode])

  const currentCueProgress = useMemo(() => {
    const cue = cues[activeCueIndex]
    if (!cue) {
      return 0
    }

    return clamp((playheadSec - cue.start) / Math.max(cue.duration, 0.001), 0, 1)
  }, [activeCueIndex, cues, playheadSec])

  const passProgress = totalDuration > 0 ? clamp(playheadSec / totalDuration, 0, 1) : 0

  const remainingLoops =
    repeatTarget === 'inf' ? null : Math.max(repeatTarget - completedLoops, 0)

  const canEditTimings = Boolean(audioUrl) || isAdvancedOpen

  const trackEvent = useCallback(
    (eventName: FunnelEventName, payload: Record<string, unknown> = {}) => {
      if (typeof window === 'undefined') {
        return
      }

      const eventPayload = {
        event: eventName,
        source: 'prep_screen',
        view_mode: viewMode,
        user_id: analyticsUserId,
        ts: new Date().toISOString(),
        experiments: experimentAssignments,
        ...payload,
      }

      window.dataLayer = window.dataLayer ?? []
      window.dataLayer.push(eventPayload)
      window.dispatchEvent(
        new CustomEvent('jaleco:analytics', {
          detail: eventPayload,
        }),
      )
    },
    [analyticsUserId, experimentAssignments, viewMode],
  )

  const prepSettingsSnapshot = useMemo(
    () => ({
      pair_import_mode: pairImportMode,
      study_mode: studyMode,
      blind_mode: blindMode,
      repeat_target: repeatTarget === 'inf' ? 'inf' : `${repeatTarget}`,
      playback_rate: playbackRate,
      sync_mode: syncMode,
      editor_tab: prepEditorTab,
      audio_loaded: Boolean(audioUrl),
      audio_expanded: isAudioExpanded,
      advanced_open: isAdvancedOpen,
      preset: activePreset ?? 'none',
      preset_modified: isPresetModified,
      countdown_enabled: countdownEnabled,
      haptic_enabled: hapticEnabled,
      line_spacing: lineSpacing,
      font_level: fontLevel,
      dark_mode: darkMode,
      focus_mode: focusMode,
    }),
    [
      activePreset,
      audioUrl,
      blindMode,
      countdownEnabled,
      darkMode,
      focusMode,
      fontLevel,
      hapticEnabled,
      isAdvancedOpen,
      isAudioExpanded,
      isPresetModified,
      lineSpacing,
      pairImportMode,
      playbackRate,
      repeatTarget,
      studyMode,
      syncMode,
      prepEditorTab,
    ],
  )

  const presetOutOfSync = useMemo(() => {
    if (!activePreset) {
      return false
    }

    const config = PRESET_CONFIGS[activePreset]
    if (studyMode !== config.studyMode) {
      return true
    }
    if (blindMode !== config.blindMode) {
      return true
    }
    if (playbackRate !== config.playbackRate) {
      return true
    }
    if (repeatTarget !== config.repeatTarget) {
      return true
    }
    if (typeof config.focusMode === 'boolean' && focusMode !== config.focusMode) {
      return true
    }
    if (typeof config.countdownEnabled === 'boolean' && countdownEnabled !== config.countdownEnabled) {
      return true
    }

    return false
  }, [
    activePreset,
    blindMode,
    countdownEnabled,
    focusMode,
    playbackRate,
    repeatTarget,
    studyMode,
  ])

  useEffect(() => {
    if (!activePreset || isPresetModified) {
      return
    }

    if (presetOutOfSync) {
      setIsPresetModified(true)
    }
  }, [activePreset, isPresetModified, presetOutOfSync])

  useEffect(() => {
    if (!canEditTimings && prepEditorTab === 'timing') {
      setPrepEditorTab('text')
    }
  }, [canEditTimings, prepEditorTab])

  useEffect(() => {
    if (!prepStateHydrated || viewMode !== 'prep') {
      prepViewTrackedRef.current = false
      return
    }

    if (prepViewTrackedRef.current) {
      return
    }

    prepViewTrackedRef.current = true
    prepAbandonTrackedRef.current = false

    trackEvent('prep_view', {
      frases: cues.length,
      duracion_vuelta: Number(totalDuration.toFixed(2)),
      repeticiones: repeatTarget === 'inf' ? 'inf' : repeatTarget,
      audio_cargado: Boolean(audioUrl),
    })
  }, [audioUrl, cues.length, prepStateHydrated, repeatTarget, totalDuration, trackEvent, viewMode])

  useEffect(() => {
    const snapshot = prepSettingsSnapshot as Record<string, string | number | boolean | null>

    if (!prepStateHydrated || viewMode !== 'prep') {
      previousSettingsRef.current = snapshot
      return
    }

    const previous = previousSettingsRef.current
    if (!previous) {
      previousSettingsRef.current = snapshot
      return
    }

    ;(Object.keys(snapshot) as Array<keyof typeof snapshot>).forEach((key) => {
      if (previous[key] === snapshot[key]) {
        return
      }

      trackEvent('prep_change_setting', {
        setting: key,
        value: snapshot[key],
      })
    })

    previousSettingsRef.current = snapshot
  }, [prepSettingsSnapshot, prepStateHydrated, trackEvent, viewMode])

  useEffect(() => {
    if (!prepStateHydrated || typeof window === 'undefined') {
      return
    }

    const rawExposed = readStorage(window.sessionStorage, AB_EXPOSURE_KEY)
    let exposed = new Set<ExperimentKey>()

    if (rawExposed) {
      try {
        exposed = new Set(JSON.parse(rawExposed) as ExperimentKey[])
      } catch {
        exposed = new Set<ExperimentKey>()
      }
    }

    ;(Object.keys(experimentAssignments) as ExperimentKey[]).forEach((experimentKey) => {
      if (exposed.has(experimentKey) || exposedExperimentsRef.current.has(experimentKey)) {
        return
      }

      const definition = EXPERIMENT_DEFINITIONS[experimentKey]
      const variant = experimentAssignments[experimentKey]

      trackEvent('ab_exposure', {
        experiment_key: experimentKey,
        experiment_name: definition.name,
        variant,
        metric_primary: definition.primaryMetric,
        metric_secondary: definition.secondaryMetric,
      })

      exposedExperimentsRef.current.add(experimentKey)
      exposed.add(experimentKey)
    })

    writeStorage(window.sessionStorage, AB_EXPOSURE_KEY, JSON.stringify(Array.from(exposed)))
  }, [experimentAssignments, prepStateHydrated, trackEvent])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handlePageHide = () => {
      if (viewMode !== 'prep' || liveStartedTrackedRef.current || prepAbandonTrackedRef.current) {
        return
      }

      prepAbandonTrackedRef.current = true
      trackEvent('prep_abandon', {
        frases: cues.length,
        audio_cargado: Boolean(audioUrl),
      })
    }

    window.addEventListener('pagehide', handlePageHide)
    return () => {
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [audioUrl, cues.length, trackEvent, viewMode])

  const setGestureFeedback = useCallback((message: string) => {
    setGestureMessage(message)

    if (gestureMessageTimerRef.current !== null) {
      window.clearTimeout(gestureMessageTimerRef.current)
    }

    gestureMessageTimerRef.current = window.setTimeout(() => {
      setGestureMessage('')
    }, 850)
  }, [])

  const showTimingNotice = useCallback((message: string) => {
    setTimingNotice(message)

    if (timingNoticeTimerRef.current !== null) {
      window.clearTimeout(timingNoticeTimerRef.current)
    }

    timingNoticeTimerRef.current = window.setTimeout(() => {
      setTimingNotice('')
    }, 1800)
  }, [])

  const seekTo = useCallback(
    (nextTime: number) => {
      const clamped = clamp(nextTime, 0, totalDurationRef.current)
      setPlayheadSec(clamped)

      const audio = audioRef.current
      if (audio && audioUrl) {
        audio.currentTime = clamped
      }
    },
    [audioUrl],
  )

  const seekBy = useCallback(
    (delta: number) => {
      seekTo(playheadSec + delta)
      setGestureFeedback(delta < 0 ? '-10s' : '+10s')
    },
    [playheadSec, seekTo, setGestureFeedback],
  )

  const seekToAdjacentCue = useCallback(
    (direction: -1 | 1) => {
      if (cues.length === 0) {
        return
      }

      const nextIndex = clamp(activeCueIndex + direction, 0, cues.length - 1)
      const nextCue = cues[nextIndex]
      if (!nextCue) {
        return
      }

      seekTo(nextCue.start)
      setControlsVisible(true)
      setGestureFeedback(`Frase ${nextIndex + 1}/${cues.length}`)
    },
    [activeCueIndex, cues, seekTo, setGestureFeedback],
  )

  const adjustVolumeBy = useCallback(
    (delta: number) => {
      const nextVolume = clamp(Number((volumeRef.current + delta).toFixed(2)), 0, 1)
      volumeRef.current = nextVolume
      setVolume(nextVolume)
      setControlsVisible(true)
      setGestureFeedback(`Volumen ${Math.round(nextVolume * 100)}%`)
    },
    [setGestureFeedback],
  )

  const readEditorTimeSec = useCallback(() => {
    const audio = audioRef.current
    if (audio && audioUrl) {
      return audio.currentTime
    }

    return playheadSec
  }, [audioUrl, playheadSec])

  const mutateManualStarts = useCallback(
    (mutate: (starts: number[]) => void) => {
      if (cueDrafts.length === 0) {
        return
      }

      setManualStarts((current) => {
        const baseline = current.length === cueDrafts.length ? [...current] : [...fallbackStarts]
        mutate(baseline)
        return sanitizeManualStarts(baseline, cueDrafts.length, syncDurationBase, fallbackStarts)
      })
      setSyncMode('manual')
    },
    [cueDrafts.length, fallbackStarts, syncDurationBase],
  )

  const restoreAutoSync = useCallback(() => {
    setSyncMode('auto')
    setManualStarts([])
    setTimeInputDrafts({})
    showTimingNotice('Tiempos estimados regenerados.')
  }, [showTimingNotice])

  const markStartAndAdvance = useCallback(() => {
    if (cueDrafts.length === 0) {
      return
    }

    const index = clamp(timingCursor, 0, cueDrafts.length - 1)
    const markedTime = clamp(readEditorTimeSec(), 0, Math.max(totalDurationRef.current, 0))

    mutateManualStarts((starts) => {
      starts[index] = markedTime
    })

    setTimingCursor(Math.min(index + 1, cueDrafts.length - 1))
    showTimingNotice(`Frase ${index + 1} en ${formatTimeWithCentiseconds(markedTime)}`)
  }, [cueDrafts.length, mutateManualStarts, readEditorTimeSec, showTimingNotice, timingCursor])

  const markEndAtCursor = useCallback(() => {
    if (cueDrafts.length === 0) {
      return
    }

    const index = clamp(timingCursor, 0, cueDrafts.length - 1)
    if (index >= cueDrafts.length - 1) {
      showTimingNotice('La última frase termina al final del audio.')
      return
    }

    const markedTime = clamp(readEditorTimeSec(), 0, Math.max(totalDurationRef.current, 0))

    mutateManualStarts((starts) => {
      starts[index + 1] = markedTime
    })

    setTimingCursor(index + 1)
    showTimingNotice(`Fin frase ${index + 1} en ${formatTimeWithCentiseconds(markedTime)}`)
  }, [cueDrafts.length, mutateManualStarts, readEditorTimeSec, showTimingNotice, timingCursor])

  const shiftFromCursor = useCallback(
    (delta: number) => {
      if (cueDrafts.length === 0) {
        return
      }

      const fromIndex = clamp(timingCursor, 0, cueDrafts.length - 1)
      mutateManualStarts((starts) => {
        for (let index = fromIndex; index < starts.length; index += 1) {
          starts[index] += delta
        }
      })

      showTimingNotice(
        `Mover ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}s desde frase ${fromIndex + 1}`,
      )
    },
    [cueDrafts.length, mutateManualStarts, showTimingNotice, timingCursor],
  )

  const handleStartInputChange = useCallback((index: number, value: string) => {
    setTimingCursor(index)
    setTimeInputDrafts((current) => ({
      ...current,
      [index]: value,
    }))
  }, [])

  const clearTimeInputDraft = useCallback((index: number) => {
    setTimeInputDrafts((current) => {
      if (!(index in current)) {
        return current
      }

      const next = { ...current }
      delete next[index]
      return next
    })
  }, [])

  const commitStartInput = useCallback(
    (index: number) => {
      const source = timeInputDrafts[index]
      if (!source) {
        return
      }

      const parsed = parseTimecode(source)
      if (parsed === null) {
        clearTimeInputDraft(index)
        showTimingNotice('Formato inválido. Usa mm:ss.cs o segundos.')
        return
      }

      const bounded = Math.max(0, parsed)
      mutateManualStarts((starts) => {
        starts[index] = bounded
      })
      clearTimeInputDraft(index)
      showTimingNotice(`Frase ${index + 1} ajustada a ${formatTimeWithCentiseconds(bounded)}`)
    },
    [clearTimeInputDraft, mutateManualStarts, showTimingNotice, timeInputDrafts],
  )

  const handleStartInputKeyDown = useCallback(
    (index: number, event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        event.currentTarget.blur()
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        clearTimeInputDraft(index)
        event.currentTarget.blur()
      }
    },
    [clearTimeInputDraft],
  )

  const selectCueForTiming = useCallback(
    (index: number) => {
      const cue = cuesForEditor[index]
      if (!cue) {
        return
      }

      setTimingCursor(index)
      seekTo(cue.start)
    },
    [cuesForEditor, seekTo],
  )

  const togglePrepAudio = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !audioUrl) {
      showTimingNotice('Carga un audio para marcar sincronía real.')
      return
    }

    if (isPrepAudioPlaying) {
      audio.pause()
      setIsPrepAudioPlaying(false)
      return
    }

    audio.playbackRate = 1
    audio.volume = volume
    audio.currentTime = clamp(playheadSec, 0, totalDurationRef.current)

    try {
      await audio.play()
      setIsPrepAudioPlaying(true)
    } catch {
      setIsPrepAudioPlaying(false)
      showTimingNotice('No se pudo reproducir el audio.')
    }
  }, [audioUrl, isPrepAudioPlaying, playheadSec, showTimingNotice, volume])

  const seekEditorBy = useCallback(
    (delta: number) => {
      seekTo(readEditorTimeSec() + delta)
    },
    [readEditorTimeSec, seekTo],
  )

  const exportCurrentCues = useCallback(
    (format: 'vtt' | 'srt') => {
      if (cuesForEditor.length === 0) {
        return
      }

      const payload = format === 'vtt' ? serializeVtt(cuesForEditor) : serializeSrt(cuesForEditor)
      const stamp = new Date().toISOString().slice(0, 10)
      downloadTextFile(`jaleco-sync-${stamp}.${format}`, payload)
      showTimingNotice(`Exportado ${format.toUpperCase()}`)
    },
    [cuesForEditor, showTimingNotice],
  )

  const showLoopToast = useCallback((message: string) => {
    setLoopToast(message)

    if (loopToastTimerRef.current !== null) {
      window.clearTimeout(loopToastTimerRef.current)
    }

    loopToastTimerRef.current = window.setTimeout(() => {
      setLoopToast('')
    }, 900)
  }, [])

  const finishPass = useCallback(() => {
    if (endLockRef.current) {
      return
    }

    endLockRef.current = true

    const target = repeatTargetRef.current
    const nextCompleted = completedLoopsRef.current + 1
    const finite = target !== 'inf'
    const shouldRestart = !finite || nextCompleted < target

    if (shouldRestart) {
      completedLoopsRef.current = nextCompleted
      setCompletedLoops(nextCompleted)

      const nextPass = nextCompleted + 1
      const toast = finite
        ? `Repetición ${Math.min(nextPass, target)}/${target}`
        : `Repetición ${nextPass}`

      showLoopToast(toast)
      setPlayheadSec(0)
      setPlaybackStatus('playing')

      const audio = audioRef.current
      if (audio && audioUrl) {
        audio.currentTime = 0
        void audio.play().catch(() => {
          setPlaybackStatus('paused')
        })
      }
    } else {
      completedLoopsRef.current = nextCompleted
      setCompletedLoops(nextCompleted)
      setPlayheadSec(totalDurationRef.current)
      setPlaybackStatus('paused')

      const audio = audioRef.current
      if (audio && audioUrl) {
        audio.pause()
      }
    }

    window.setTimeout(() => {
      endLockRef.current = false
    }, 120)
  }, [audioUrl, showLoopToast])

  const startPlaybackNow = useCallback(async () => {
    if (totalDurationRef.current <= 0 || cues.length === 0) {
      return
    }

    if (!liveStartedTrackedRef.current) {
      liveStartedTrackedRef.current = true
      prepAbandonTrackedRef.current = true

      trackEvent('live_started', {
        frases: cues.length,
        repeticiones: repeatTargetRef.current === 'inf' ? 'inf' : repeatTargetRef.current,
      })

      ;(Object.keys(experimentAssignments) as ExperimentKey[]).forEach((experimentKey) => {
        trackEvent('ab_conversion', {
          experiment_key: experimentKey,
          variant: experimentAssignments[experimentKey],
          conversion_event: 'live_started',
        })
      })
    }

    setPlaybackStatus('playing')
    setControlsVisible(true)

    const audio = audioRef.current
    if (audio && audioUrl) {
      audio.playbackRate = playbackRate
      audio.volume = volume
      audio.currentTime = clamp(playheadSec, 0, totalDurationRef.current)

      try {
        await audio.play()
      } catch {
        setPlaybackStatus('paused')
      }
    }
  }, [audioUrl, cues.length, experimentAssignments, playbackRate, playheadSec, trackEvent, volume])

  const resetSession = useCallback(() => {
    setPlaybackStatus('stopped')
    setPlayheadSec(0)
    setCompletedLoops(0)
    completedLoopsRef.current = 0
    setCountdownValue(0)
    setIsPrepAudioPlaying(false)

    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
  }, [])

  const handleBackToPreparation = useCallback(() => {
    resetSession()
    liveStartedTrackedRef.current = false
    setViewMode('prep')
  }, [resetSession])

  const togglePlayback = useCallback(() => {
    if (isActivePlayback) {
      setPlaybackStatus('paused')
      const audio = audioRef.current
      if (audio) {
        audio.pause()
      }
      return
    }

    if (playbackStatus === 'countdown') {
      setPlaybackStatus('paused')
      setCountdownValue(0)
      return
    }

    if (viewMode === 'prep') {
      const audio = audioRef.current
      if (audio) {
        audio.pause()
      }
      setIsPrepAudioPlaying(false)
      setViewMode('live')
    }

    if (playheadSec >= totalDurationRef.current - 0.03) {
      setPlayheadSec(0)
      setCompletedLoops(0)
      completedLoopsRef.current = 0
    }

    if (playbackStatus === 'paused') {
      void startPlaybackNow()
      return
    }

    if (countdownEnabled) {
      setPlaybackStatus('countdown')
      setCountdownValue(3)
      return
    }

    void startPlaybackNow()
  }, [
    countdownEnabled,
    isActivePlayback,
    playbackStatus,
    playheadSec,
    startPlaybackNow,
    viewMode,
  ])

  const handlePrepStart = useCallback(() => {
    if (viewMode !== 'prep') {
      togglePlayback()
      return
    }

    trackEvent('prep_click_start_live', {
      frases: cues.length,
      duracion_vuelta: Number(totalDuration.toFixed(2)),
      repeticiones: repeatTarget === 'inf' ? 'inf' : repeatTarget,
      audio_cargado: Boolean(audioUrl),
    })

    ;(Object.keys(experimentAssignments) as ExperimentKey[]).forEach((experimentKey) => {
      trackEvent('ab_conversion', {
        experiment_key: experimentKey,
        variant: experimentAssignments[experimentKey],
        conversion_event: 'prep_click_start_live',
      })
    })

    togglePlayback()
  }, [
    audioUrl,
    cues.length,
    experimentAssignments,
    repeatTarget,
    togglePlayback,
    totalDuration,
    trackEvent,
    viewMode,
  ])

  const snapToFocusCue = useCallback(
    (behavior: ScrollBehavior) => {
      const stage = stageRef.current
      const lineNode = cueRefs.current[focusCueIndex]

      if (!stage || !lineNode) {
        return
      }

      const target =
        lineNode.offsetTop - stage.clientHeight * LIVE_FOCUS_POINT + lineNode.clientHeight * 0.5

      autoScrollFlagRef.current = true
      stage.scrollTo({
        top: Math.max(0, target),
        behavior,
      })

      window.setTimeout(() => {
        autoScrollFlagRef.current = false
      }, 320)
    },
    [focusCueIndex],
  )

  const returnToFollow = useCallback(() => {
    setPlaybackStatus('playing')
    snapToFocusCue('smooth')
  }, [snapToFocusCue])

  const enforceTranslationRepeatFloor = useCallback(() => {
    setRepeatTarget((current) => {
      if (typeof current === 'number' && current < 5) {
        showLoopToast('Repeticiones: x5')
        return 5
      }

      return current
    })
  }, [showLoopToast])

  const applyRepeatTarget = useCallback(
    (nextTarget: RepeatTarget) => {
      if (showTranslation && typeof nextTarget === 'number' && nextTarget < 5) {
        setRepeatTarget(5)
        showLoopToast('Repeticiones: x5')
        return
      }

      setRepeatTarget(nextTarget)
    },
    [showLoopToast, showTranslation],
  )

  const applyStudyMode = useCallback(
    (mode: StudyMode) => {
      setStudyMode(mode)
      if (mode === 'with-translation') {
        enforceTranslationRepeatFloor()
      }
    },
    [enforceTranslationRepeatFloor],
  )

  const applyPreset = useCallback(
    (preset: PresetKey) => {
      const config = PRESET_CONFIGS[preset]

      applyStudyMode(config.studyMode)
      setBlindMode(config.blindMode)
      setPlaybackRate(config.playbackRate as (typeof SPEED_OPTIONS)[number])
      applyRepeatTarget(config.repeatTarget)
      if (typeof config.focusMode === 'boolean') {
        setFocusMode(config.focusMode)
      }
      if (typeof config.countdownEnabled === 'boolean') {
        setCountdownEnabled(config.countdownEnabled)
      }

      setActivePreset(preset)
      setIsPresetModified(false)
    },
    [applyRepeatTarget, applyStudyMode],
  )

  const toggleAudioPanel = useCallback(() => {
    setIsAudioExpanded((current) => {
      const next = !current
      if (next) {
        trackEvent('prep_audio_expand', {
          audio_cargado: Boolean(audioUrl),
        })
      }
      return next
    })
  }, [audioUrl, trackEvent])

  const handlePairImportModeChange = (next: boolean) => {
    if (pairImportMode === next) {
      return
    }

    const nextCueCount = buildCueDrafts(lyrics, next).length
    if (syncMode === 'manual' && cueDrafts.length !== nextCueCount) {
      setSyncMode('auto')
      setManualStarts([])
      setTimingCursor(0)
      setTimeInputDrafts({})
      showTimingNotice('Cambió el conteo de frases. Se regeneraron tiempos automáticos.')
    }

    setPairImportMode(next)
    resetSession()
  }

  const handleLyricsChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextLyrics = event.target.value
    const nextCueCount = buildCueDrafts(nextLyrics, pairImportMode).length
    if (syncMode === 'manual' && cueDrafts.length !== nextCueCount) {
      setSyncMode('auto')
      setManualStarts([])
      setTimingCursor(0)
      setTimeInputDrafts({})
      showTimingNotice('Cambió el conteo de frases. Se regeneraron tiempos automáticos.')
    }

    setLyrics(nextLyrics)
    resetSession()
  }

  const handleAudioUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }

    const nextUrl = URL.createObjectURL(file)
    setAudioUrl(nextUrl)
    setAudioDurationSec(0)
    setAudioLabel(file.name)
    resetSession()
  }

  const removeAudio = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }

    setAudioUrl('')
    setAudioDurationSec(0)
    setAudioLabel('Sin audio (modo lectura)')
    resetSession()
  }

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }
    } else if (document.exitFullscreen) {
      await document.exitFullscreen()
    }
  }, [])

  useEffect(() => {
    cueRefs.current = cueRefs.current.slice(0, cues.length)
  }, [cues.length])

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [])

  useEffect(() => {
    if (playbackStatus !== 'countdown') {
      return
    }

    let current = 3

    const timer = window.setInterval(() => {
      current -= 1
      if (current <= 0) {
        window.clearInterval(timer)
        setCountdownValue(0)
        void startPlaybackNow()
        return
      }

      setCountdownValue(current)
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [playbackStatus, startPlaybackNow])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setAudioDurationSec(audio.duration)
      }
    }

    const onEnded = () => {
      setIsPrepAudioPlaying(false)
      setPlayheadSec(audio.currentTime)

      if (isActivePlayback) {
        finishPass()
      }
    }

    const onTimeUpdate = () => {
      if (!isActivePlayback) {
        setPlayheadSec(audio.currentTime)
      }
    }

    const onPlay = () => {
      if (!isActivePlayback) {
        setIsPrepAudioPlaying(true)
      }
    }

    const onPause = () => {
      if (!isActivePlayback) {
        setIsPrepAudioPlaying(false)
      }
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [finishPass, isActivePlayback])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    audio.playbackRate = playbackRate
  }, [playbackRate])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    audio.volume = volume
  }, [volume])

  useEffect(() => {
    if (!isActivePlayback || !audioUrl) {
      return
    }

    let rafId = 0

    const syncAudioTime = () => {
      const audio = audioRef.current
      if (audio) {
        setPlayheadSec(audio.currentTime)
      }

      rafId = window.requestAnimationFrame(syncAudioTime)
    }

    rafId = window.requestAnimationFrame(syncAudioTime)

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [audioUrl, isActivePlayback])

  useEffect(() => {
    if (!isActivePlayback || audioUrl || totalDuration <= 0) {
      return
    }

    let rafId = 0
    let lastFrame = performance.now()

    const tick = (now: number) => {
      const delta = (now - lastFrame) / 1000
      lastFrame = now

      setPlayheadSec((previous) => {
        const next = previous + delta * playbackRate
        if (next >= totalDurationRef.current) {
          finishPass()
          return previous
        }

        return next
      })

      rafId = window.requestAnimationFrame(tick)
    }

    rafId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [audioUrl, finishPass, isActivePlayback, playbackRate, totalDuration])

  useEffect(() => {
    if (viewMode !== 'live' || playbackStatus !== 'playing') {
      return
    }

    snapToFocusCue('smooth')
  }, [focusCueIndex, playbackStatus, snapToFocusCue, viewMode])

  useEffect(() => {
    if (viewMode !== 'live') {
      return
    }

    const timer = window.setTimeout(() => {
      snapToFocusCue('auto')
    }, 50)

    return () => {
      window.clearTimeout(timer)
    }
  }, [snapToFocusCue, viewMode])

  useEffect(() => {
    if (lastActiveCueRef.current === activeCueIndex) {
      return
    }

    const shouldVibrate =
      hapticEnabled && isActivePlayback && typeof navigator !== 'undefined' && 'vibrate' in navigator

    if (shouldVibrate && lastActiveCueRef.current >= 0) {
      navigator.vibrate(8)
    }

    lastActiveCueRef.current = activeCueIndex
  }, [activeCueIndex, hapticEnabled, isActivePlayback])

  useEffect(() => {
    if (hideControlsTimerRef.current !== null) {
      window.clearTimeout(hideControlsTimerRef.current)
    }

    if (viewMode !== 'live' || !controlsVisible || !isActivePlayback) {
      return
    }

    hideControlsTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false)
      setVolumePanelVisible(false)
    }, HIDE_CONTROLS_MS)

    return () => {
      if (hideControlsTimerRef.current !== null) {
        window.clearTimeout(hideControlsTimerRef.current)
      }
    }
  }, [controlsVisible, isActivePlayback, viewMode])

  useEffect(() => {
    if (viewMode !== 'live') {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return
      }

      if (isTextEntryTarget(event.target) || isInteractiveTarget(event.target)) {
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()

        if (event.repeat) {
          return
        }

        togglePlayback()
        setControlsVisible(true)
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        seekToAdjacentCue(-1)
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        seekToAdjacentCue(1)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        adjustVolumeBy(KEYBOARD_VOLUME_STEP)
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        adjustVolumeBy(-KEYBOARD_VOLUME_STEP)
        return
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        void toggleFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [adjustVolumeBy, seekToAdjacentCue, toggleFullscreen, togglePlayback, viewMode])

  useEffect(() => {
    return () => {
      if (loopToastTimerRef.current !== null) {
        window.clearTimeout(loopToastTimerRef.current)
      }

      if (gestureMessageTimerRef.current !== null) {
        window.clearTimeout(gestureMessageTimerRef.current)
      }

      if (singleTapTimerRef.current !== null) {
        window.clearTimeout(singleTapTimerRef.current)
      }

      if (timingNoticeTimerRef.current !== null) {
        window.clearTimeout(timingNoticeTimerRef.current)
      }
    }
  }, [])

  const handleStageScroll = () => {
    if (autoScrollFlagRef.current) {
      return
    }

    if (playbackStatus === 'playing') {
      setPlaybackStatus('exploring')
      setControlsVisible(true)
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(event.target)) {
      return
    }

    gestureStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPlayhead: playheadSec,
      startFontLevel: fontLevel,
      mode: 'pending',
      moved: false,
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = gestureStateRef.current

    if (state.pointerId !== event.pointerId || state.mode === 'idle') {
      return
    }

    const deltaX = event.clientX - state.startX
    const deltaY = event.clientY - state.startY
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (!state.moved && (absX > 8 || absY > 8)) {
      state.moved = true
    }

    if (state.mode === 'pending') {
      if (absX > 16 && absX > absY + 8) {
        state.mode = 'horizontal'
      } else if (absY > 44 && absY > absX + 12) {
        state.mode = 'vertical'
      }
    }

    if (state.mode === 'horizontal') {
      event.preventDefault()

      const stage = stageRef.current
      const width = stage?.clientWidth ?? 1
      const secondsDelta = (deltaX / width) * totalDurationRef.current

      seekTo(state.startPlayhead + secondsDelta)
      setGestureFeedback(`Seek ${formatTime(state.startPlayhead + secondsDelta)}`)
      setControlsVisible(true)
    }

    if (state.mode === 'vertical') {
      const stepShift = Math.trunc((-deltaY) / 72)
      const nextLevel = clamp(state.startFontLevel + stepShift, 0, FONT_LEVELS.length - 1)

      if (nextLevel !== fontLevel) {
        setFontLevel(nextLevel)
        setGestureFeedback(`Texto ${nextLevel + 1}/${FONT_LEVELS.length}`)
      }
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = gestureStateRef.current

    if (state.pointerId !== event.pointerId) {
      return
    }

    if (state.mode === 'horizontal' || state.mode === 'vertical') {
      gestureStateRef.current.mode = 'idle'
      gestureStateRef.current.pointerId = null
      return
    }

    if (state.moved) {
      gestureStateRef.current.mode = 'idle'
      gestureStateRef.current.pointerId = null
      return
    }

    if (isInteractiveTarget(event.target)) {
      gestureStateRef.current.mode = 'idle'
      gestureStateRef.current.pointerId = null
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - bounds.left) / bounds.width

    let side: TapSide = 'center'
    if (ratio < 0.34) {
      side = 'left'
    } else if (ratio > 0.66) {
      side = 'right'
    }

    const now = performance.now()
    const previousTap = lastTapRef.current

    if (
      side !== 'center' &&
      previousTap.side === side &&
      now - previousTap.time < DOUBLE_TAP_MS
    ) {
      if (singleTapTimerRef.current !== null) {
        window.clearTimeout(singleTapTimerRef.current)
      }

      seekBy(side === 'left' ? -10 : 10)
      lastTapRef.current = { time: 0, side: 'center' }
      gestureStateRef.current.mode = 'idle'
      gestureStateRef.current.pointerId = null
      return
    }

    lastTapRef.current = { time: now, side }

    if (singleTapTimerRef.current !== null) {
      window.clearTimeout(singleTapTimerRef.current)
    }

    singleTapTimerRef.current = window.setTimeout(() => {
      setControlsVisible((visible) => !visible)
      if (controlsVisible) {
        setVolumePanelVisible(false)
      }
    }, DOUBLE_TAP_MS)

    gestureStateRef.current.mode = 'idle'
    gestureStateRef.current.pointerId = null
  }

  const liveClassName = [
    'teleprompter-shell',
    darkMode ? 'theme-dark' : 'theme-light',
    viewMode === 'live' ? 'mode-live' : 'mode-prep',
    controlsVisible ? 'controls-visible' : 'controls-hidden',
    focusMode ? 'focus-enabled' : 'focus-disabled',
    blindMode ? 'mode-blind' : 'mode-clear',
    studyMode === 'interactive' ? 'study-interactive' : 'study-standard',
  ].join(' ')

  return (
    <main className={liveClassName} style={{ '--line-height': LINE_HEIGHTS[lineSpacing] } as CSSProperties}>
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />

      {viewMode === 'prep' && (
        <section className="prep-screen">
          <header className="prep-header">
            <div>
              <p className="eyebrow">Estado 1 · Preparación</p>
              <h1>Escucha y lee la historia</h1>
            </div>
            <button className="ghost-button" onClick={toggleFullscreen} data-interactive="true" type="button">
              {isFullscreen ? 'Salir pantalla completa' : 'Pantalla completa'}
            </button>
          </header>

          <div className="prep-grid">
            <div className="field prep-editor">
              <div className="field-header">
                <span>Texto / frases</span>
                <div className="chip-row compact prep-editor-tabs" role="tablist" aria-label="Editor de preparación">
                  <ChipSelectable
                    selected={prepEditorTab === 'text'}
                    onClick={() => setPrepEditorTab('text')}
                    role="tab"
                    ariaSelected={prepEditorTab === 'text'}
                  >
                    Editar texto
                  </ChipSelectable>
                  {canEditTimings && (
                    <ChipSelectable
                      selected={prepEditorTab === 'timing'}
                      onClick={() => setPrepEditorTab('timing')}
                      role="tab"
                      ariaSelected={prepEditorTab === 'timing'}
                    >
                      Editar tiempos
                    </ChipSelectable>
                  )}
                </div>
              </div>

              {!canEditTimings && (
                <p className="field-hint">
                  Editar tiempos se habilita al cargar audio o al abrir Ajustes avanzados.
                </p>
              )}

              {prepEditorTab === 'text' && (
                <>
                  <textarea
                    value={lyrics}
                    onChange={handleLyricsChange}
                    placeholder={
                      pairImportMode
                        ? 'Pega líneas alternadas: EN, ES, EN, ES...'
                        : 'Escribe una línea por frase'
                    }
                    data-interactive="true"
                  />
                  <div className="chip-row compact" role="radiogroup" aria-label="Modo de importación">
                    <ChipSelectable
                      selected={!pairImportMode}
                      onClick={() => handlePairImportModeChange(false)}
                      role="radio"
                      ariaChecked={!pairImportMode}
                    >
                      1 línea = 1 frase
                    </ChipSelectable>
                    <ChipSelectable
                      selected={pairImportMode}
                      onClick={() => handlePairImportModeChange(true)}
                      role="radio"
                      ariaChecked={pairImportMode}
                    >
                      EN/ES alternado
                    </ChipSelectable>
                  </div>
                  {pairImportMode && (
                    <p className="field-hint">
                      Se agrupan 2 líneas: primera EN y segunda ES. Si falta la última, queda solo EN.
                    </p>
                  )}
                </>
              )}

              {prepEditorTab === 'timing' && (
                <div className="timing-editor">
                  <div className="timing-toolbar">
                    <p className="field-hint">
                      {syncMode === 'manual'
                        ? 'Sincronización manual activa'
                        : 'Sincronización automática estimada'}
                    </p>
                    <div className="chip-row compact">
                      <ChipSelectable
                        selected={syncMode === 'auto'}
                        onClick={restoreAutoSync}
                      >
                        Automática
                      </ChipSelectable>
                      <ChipSelectable
                        selected={false}
                        onClick={() => shiftFromCursor(-SHIFT_STEP_SEC)}
                        disabled={cueDrafts.length === 0}
                      >
                        Mover -0.2 s
                      </ChipSelectable>
                      <ChipSelectable
                        selected={false}
                        onClick={() => shiftFromCursor(SHIFT_STEP_SEC)}
                        disabled={cueDrafts.length === 0}
                      >
                        Mover +0.2 s
                      </ChipSelectable>
                    </div>
                  </div>

                  <div className="timing-player" data-interactive="true">
                    <div className="timing-player-actions">
                      <button
                        className="play-button"
                        type="button"
                        onClick={togglePrepAudio}
                        disabled={!audioUrl}
                        data-interactive="true"
                      >
                        {isPrepAudioPlaying ? 'Pausa' : 'Reproducir'}
                      </button>
                      <button
                        className="ghost-button small"
                        type="button"
                        onClick={() => seekEditorBy(-5)}
                        disabled={cuesForEditor.length === 0}
                        data-interactive="true"
                      >
                        -5s
                      </button>
                      <button
                        className="ghost-button small"
                        type="button"
                        onClick={() => seekEditorBy(5)}
                        disabled={cuesForEditor.length === 0}
                        data-interactive="true"
                      >
                        +5s
                      </button>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={editorDuration}
                      step={0.01}
                      value={clamp(playheadSec, 0, editorDuration)}
                      onChange={(event) => seekTo(Number(event.target.value))}
                      disabled={cuesForEditor.length === 0}
                      data-interactive="true"
                    />

                    <div className="timing-player-meta">
                      <span>{formatTimeWithCentiseconds(playheadSec)}</span>
                      <span>{formatTimeWithCentiseconds(editorDuration)}</span>
                    </div>

                    <div className="timing-player-actions">
                      <button
                        className="primary-button timing-cta"
                        type="button"
                        onClick={markStartAndAdvance}
                        disabled={cuesForEditor.length === 0}
                        data-interactive="true"
                      >
                        Marcar inicio y siguiente
                      </button>
                      <button
                        className="ghost-button small"
                        type="button"
                        onClick={markEndAtCursor}
                        disabled={cuesForEditor.length === 0}
                        data-interactive="true"
                      >
                        Marcar fin
                      </button>
                    </div>
                  </div>

                  <div className="timing-list">
                    {cuesForEditor.map((cue, index) => (
                      <article
                        key={cue.id}
                        className={index === timingCursor ? 'timing-row is-active' : 'timing-row'}
                      >
                        <div className="timing-row-head">
                          <ChipSelectable
                            selected={index === timingCursor}
                            onClick={() => selectCueForTiming(index)}
                          >
                            Frase {index + 1}
                          </ChipSelectable>
                          <span className="timing-row-end">Fin {formatTimeWithCentiseconds(cue.end)}</span>
                        </div>

                        <label className="timing-start-field">
                          <span>Inicio</span>
                          <input
                            type="text"
                            value={timeInputDrafts[index] ?? formatTimeWithCentiseconds(cue.start)}
                            onChange={(event) => handleStartInputChange(index, event.target.value)}
                            onFocus={() => setTimingCursor(index)}
                            onBlur={() => commitStartInput(index)}
                            onKeyDown={(event) => handleStartInputKeyDown(index, event)}
                            data-interactive="true"
                          />
                        </label>

                        <p className="timing-row-text">{cue.text}</p>
                        {cue.translation && <p className="timing-row-translation">{cue.translation}</p>}
                      </article>
                    ))}
                  </div>

                  {cuesForEditor.length === 0 && (
                    <p className="field-hint">Agrega texto para generar frases y empezar a sincronizar.</p>
                  )}

                  <div className="chip-row compact">
                    <ChipSelectable
                      selected={false}
                      onClick={() => exportCurrentCues('vtt')}
                      disabled={cuesForEditor.length === 0}
                    >
                      Exportar subtítulos (.vtt)
                    </ChipSelectable>
                    <ChipSelectable
                      selected={false}
                      onClick={() => exportCurrentCues('srt')}
                      disabled={cuesForEditor.length === 0}
                    >
                      Exportar subtítulos (.srt)
                    </ChipSelectable>
                  </div>

                  {timingNotice && <p className="timing-notice">{timingNotice}</p>}
                </div>
              )}
            </div>

            <div className="panel-card">
              <p className="panel-title">Ritmo y repetición</p>

              <p className="field-hint">1. Para qué (presets)</p>
              <div className="chip-row" role="radiogroup" aria-label="Presets por objetivo">
                {(['quick-start', 'without-translation', 'blind', 'interactive'] as PresetKey[]).map((preset) => (
                  <ChipSelectable
                    key={preset}
                    selected={activePreset === preset && !isPresetModified}
                    role="radio"
                    ariaChecked={activePreset === preset && !isPresetModified}
                    onClick={() => applyPreset(preset)}
                  >
                    {PRESET_LABELS[preset]}
                  </ChipSelectable>
                ))}
              </div>
              {isPresetModified && (
                <span className="chip is-active chip-static" aria-live="polite">
                  Personalizado
                </span>
              )}
              {activePreset && !isPresetModified && (
                <p className="field-hint">
                  Preset activo: {PRESET_LABELS[activePreset]}.
                </p>
              )}
              {activePreset && isPresetModified && (
                <p className="field-hint">
                  Preset personalizado manualmente. Reaplica un preset para volver al estado base.
                </p>
              )}

              <p className="field-hint">2. Personalizar (cómo)</p>

              <div className="chip-row" role="radiogroup" aria-label="Modo de práctica">
                <ChipSelectable
                  selected={studyMode === 'with-translation'}
                  role="radio"
                  ariaChecked={studyMode === 'with-translation'}
                  ariaDescribedBy="mode-help-with-translation"
                  data-help={MODE_HELP['with-translation']}
                  onClick={() => applyStudyMode('with-translation')}
                >
                  Con traducción
                </ChipSelectable>
                <ChipSelectable
                  selected={studyMode === 'without-translation'}
                  role="radio"
                  ariaChecked={studyMode === 'without-translation'}
                  ariaDescribedBy="mode-help-without-translation"
                  data-help={MODE_HELP['without-translation']}
                  onClick={() => applyStudyMode('without-translation')}
                >
                  Sin traducción
                </ChipSelectable>
                <ChipSelectable
                  selected={studyMode === 'interactive'}
                  role="radio"
                  ariaChecked={studyMode === 'interactive'}
                  ariaDescribedBy="mode-help-interactive"
                  data-help={MODE_HELP.interactive}
                  onClick={() => applyStudyMode('interactive')}
                >
                  Interactivo
                </ChipSelectable>
              </div>

              <div className="chip-row" role="group" aria-label="Opciones de apoyo">
                <ChipSelectable
                  selected={blindMode}
                  ariaPressed={blindMode}
                  ariaDescribedBy="mode-help-blind"
                  data-help={MODE_HELP.blind}
                  onClick={() => setBlindMode((current) => !current)}
                >
                  A ciegas
                </ChipSelectable>
              </div>

              <div className="study-help-shell" aria-live="polite">
                <p className="field-hint study-mode-hint">
                  {blindMode ? `${studyModeHint} A ciegas activo.` : studyModeHint}
                </p>
              </div>

              <span id="mode-help-with-translation" className="sr-only">
                {MODE_HELP['with-translation']}
              </span>
              <span id="mode-help-without-translation" className="sr-only">
                {MODE_HELP['without-translation']}
              </span>
              <span id="mode-help-interactive" className="sr-only">
                {MODE_HELP.interactive}
              </span>
              <span id="mode-help-blind" className="sr-only">
                {MODE_HELP.blind}
              </span>

              <div className="chip-row" role="radiogroup" aria-label="Velocidad">
                {SPEED_OPTIONS.map((option) => (
                  <ChipSelectable
                    key={option}
                    selected={playbackRate === option}
                    role="radio"
                    ariaChecked={playbackRate === option}
                    onClick={() => setPlaybackRate(option)}
                  >
                    {option === 1 ? 'Normal' : `${option}x`}
                  </ChipSelectable>
                ))}
              </div>

              <div className="chip-row" role="radiogroup" aria-label="Repeticiones">
                {REPEAT_OPTIONS.map((option) => (
                  <ChipSelectable
                    key={option}
                    selected={repeatTarget === option}
                    role="radio"
                    ariaChecked={repeatTarget === option}
                    onClick={() => applyRepeatTarget(option)}
                  >
                    {option === 'inf' ? '∞' : `x${option}`}
                  </ChipSelectable>
                ))}
              </div>

              <label className="slider-field">
                <span className="label-with-icon">
                  <UiIcon name="speaker" className="label-icon" />
                  Volumen {Math.round(volume * 100)}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  data-interactive="true"
                />
              </label>
            </div>

            <div className="panel-card panel-collapsible">
              <div className="panel-headline">
                <p className="panel-title panel-title-with-icon">
                  <UiIcon name="speaker" className="label-icon" />
                  Audio (opcional)
                </p>
                <button
                  type="button"
                  className="ghost-button small accordion-trigger"
                  aria-expanded={isAudioExpanded}
                  aria-controls="prep-audio-content"
                  onClick={toggleAudioPanel}
                  data-interactive="true"
                >
                  <span>{isAudioExpanded ? 'Ocultar' : 'Mostrar'}</span>
                  <UiIcon name="chevron" className={isAudioExpanded ? 'icon-chevron is-open' : 'icon-chevron'} />
                </button>
              </div>

              <p className="field-hint">
                {audioUrl ? `Audio cargado: ${audioLabel}` : 'Sin audio cargado.'}
              </p>

              {isAudioExpanded && (
                <div id="prep-audio-content" className="audio-panel-content">
                  <label className="audio-upload" data-interactive="true">
                    <span>Cargar audio</span>
                    <input type="file" accept="audio/*" onChange={handleAudioUpload} />
                  </label>

                  <p className="audio-name">{audioLabel}</p>

                  {audioUrl && (
                    <button
                      className="ghost-button small"
                      onClick={removeAudio}
                      type="button"
                      data-interactive="true"
                    >
                      Quitar audio
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="panel-card panel-collapsible">
              <div className="panel-headline">
                <p className="panel-title panel-title-with-icon">
                  <UiIcon name="settings" className="label-icon" />
                  Ajustes avanzados
                </p>
                <button
                  type="button"
                  className="ghost-button small accordion-trigger"
                  aria-expanded={isAdvancedOpen}
                  aria-controls="prep-advanced-content"
                  onClick={() => setIsAdvancedOpen((open) => !open)}
                  data-interactive="true"
                >
                  <span>{isAdvancedOpen ? 'Ocultar' : 'Mostrar'}</span>
                  <UiIcon name="chevron" className={isAdvancedOpen ? 'icon-chevron is-open' : 'icon-chevron'} />
                </button>
              </div>

              <p className="field-hint">
                Incluye opciones de legibilidad, cuenta regresiva y vibración.
              </p>

              {isAdvancedOpen && (
                <div id="prep-advanced-content" className="advanced-panel-content">
                  <div className="chip-row" role="radiogroup" aria-label="Tamaño de texto">
                    {PREVIEW_FONT_LEVELS.map((size, index) => (
                      <ChipSelectable
                        key={size}
                        selected={fontLevel === index}
                        role="radio"
                        ariaChecked={fontLevel === index}
                        onClick={() => setFontLevel(index)}
                      >
                        A{index + 1}
                      </ChipSelectable>
                    ))}
                  </div>

                  <div className="chip-row" role="radiogroup" aria-label="Espaciado">
                    {(['compact', 'normal', 'relaxed'] as const).map((option) => (
                      <ChipSelectable
                        key={option}
                        selected={lineSpacing === option}
                        role="radio"
                        ariaChecked={lineSpacing === option}
                        onClick={() => setLineSpacing(option)}
                      >
                        {option === 'compact' ? 'Compacto' : option === 'normal' ? 'Normal' : 'Relajado'}
                      </ChipSelectable>
                    ))}
                  </div>

                  <div className="option-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={countdownEnabled}
                        onChange={(event) => setCountdownEnabled(event.target.checked)}
                        data-interactive="true"
                      />
                      Cuenta regresiva 3-2-1
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={hapticEnabled}
                        onChange={(event) => setHapticEnabled(event.target.checked)}
                        data-interactive="true"
                      />
                      Vibración por frase
                    </label>
                  </div>

                  <div className="option-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={darkMode}
                        onChange={(event) => setDarkMode(event.target.checked)}
                        data-interactive="true"
                      />
                      Modo oscuro real
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={focusMode}
                        onChange={(event) => setFocusMode(event.target.checked)}
                        data-interactive="true"
                      />
                      Modo enfoque
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <footer className="prep-footer">
            <p>
              {cues.length} frases · {formatTime(totalDuration)} por vuelta ·{' '}
              {repeatTarget === 'inf' ? '∞ repeticiones' : `${repeatTarget} repeticiones`}
            </p>
            <button className="primary-button prep-start-button" onClick={handlePrepStart} type="button" data-interactive="true">
              <UiIcon name="play" className="label-icon" />
              Comenzar práctica
            </button>
          </footer>
        </section>
      )}

      {viewMode === 'live' && (
        <section
          className="live-screen"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="live-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${passProgress})` }} />
          </div>

          <aside
            className="line-indicator"
            style={{ '--pass-progress': `${passProgress}` } as CSSProperties}
            aria-hidden="true"
          >
            <span />
          </aside>

          {controlsVisible && (
            <header className="live-header" data-interactive="true">
              <button
                className="ghost-button small"
                onClick={handleBackToPreparation}
                type="button"
                data-interactive="true"
              >
                Preparación
              </button>

              <div className="repeat-badge" data-interactive="true">
                <strong>{repeatTarget === 'inf' ? '∞' : `x${repeatTarget}`}</strong>
                {remainingLoops !== null && <small>Restan: {remainingLoops}</small>}
              </div>

              <span className="chip live-mode-pill" data-interactive="true">
                {studyModeLabel}
                {blindMode ? ' · A ciegas' : ''}
              </span>

              <button className="ghost-button small" onClick={toggleFullscreen} type="button" data-interactive="true">
                {isFullscreen ? 'Salir' : 'Pantalla'}
              </button>
            </header>
          )}

          <div className="teleprompter-stage" ref={stageRef} onScroll={handleStageScroll}>
            <div className="cue-list" style={{ '--cue-font-size': `${FONT_LEVELS[fontLevel]}px` } as CSSProperties}>
              {cues.map((cue, index) => {
                const cueKind = cueKinds[index] ?? 'statement'
                const isQuestion = cueKind === 'question'
                const isTimeActive = index === activeCueIndex
                const isFocusTarget = index === focusCueIndex
                const isHighlighted =
                  studyMode === 'interactive' ? isFocusTarget && isQuestion : isFocusTarget
                const isPast = index < activeCueIndex
                const className = [
                  'cue-line',
                  isHighlighted ? 'is-active' : '',
                  isTimeActive ? 'is-time-active' : '',
                  studyMode === 'interactive' ? (isQuestion ? 'is-question' : 'is-statement') : '',
                  isPast ? 'is-past' : 'is-next',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <p
                    key={cue.id}
                    ref={(node) => {
                      cueRefs.current[index] = node
                    }}
                    className={className}
                    style={
                      isTimeActive
                        ? ({ '--cue-progress': `${currentCueProgress}` } as CSSProperties)
                        : undefined
                    }
                  >
                    <span className="cue-primary">{cue.text}</span>
                    {showTranslation && cue.translation && (
                      <span className="cue-translation">{cue.translation}</span>
                    )}
                  </p>
                )
              })}
            </div>
          </div>

          {playbackStatus === 'exploring' && (
            <button className="follow-button" onClick={returnToFollow} type="button" data-interactive="true">
              Volver a seguir
            </button>
          )}

          {gestureMessage && <div className="gesture-feedback">{gestureMessage}</div>}

          {loopToast && <div className="loop-toast">{loopToast}</div>}

          {playbackStatus === 'countdown' && countdownValue > 0 && (
            <div className="countdown-overlay">
              <span>{countdownValue}</span>
            </div>
          )}

          {controlsVisible && (
            <footer className="control-pill" data-interactive="true">
              <button className="play-button" type="button" onClick={togglePlayback} data-interactive="true">
                {isActivePlayback ? 'Pausa' : 'Reproducir'}
              </button>

              <div className="chip-row compact" role="radiogroup" aria-label="Velocidad" data-interactive="true">
                {SPEED_OPTIONS.map((option) => (
                  <ChipSelectable
                    key={option}
                    selected={playbackRate === option}
                    role="radio"
                    ariaChecked={playbackRate === option}
                    onClick={() => setPlaybackRate(option)}
                  >
                    {option === 1 ? 'Normal' : `${option}x`}
                  </ChipSelectable>
                ))}
              </div>

              <div className="chip-row compact" role="radiogroup" aria-label="Repeticiones" data-interactive="true">
                {REPEAT_OPTIONS.map((option) => (
                  <ChipSelectable
                    key={option}
                    selected={repeatTarget === option}
                    role="radio"
                    ariaChecked={repeatTarget === option}
                    onClick={() => applyRepeatTarget(option)}
                  >
                    {option === 'inf' ? '∞' : `x${option}`}
                  </ChipSelectable>
                ))}
              </div>

              <button
                type="button"
                className="ghost-button tiny"
                onClick={() => setVolumePanelVisible((open) => !open)}
                data-interactive="true"
              >
                Vol
              </button>

              {volumePanelVisible && (
                <div className="volume-pop" data-interactive="true">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                    data-interactive="true"
                  />
                </div>
              )}
            </footer>
          )}

          <div className="live-meta" data-interactive="true">
            <span>{formatTime(playheadSec)}</span>
            <span>{formatTime(totalDuration)}</span>
            <button className="ghost-button tiny" onClick={resetSession} type="button" data-interactive="true">
              Reiniciar
            </button>
          </div>
        </section>
      )}
    </main>
  )
}

export default App

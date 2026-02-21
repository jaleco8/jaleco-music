import {
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
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
const PREP_STORAGE_KEY = 'jaleco-music:prep-sync:v1'

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const splitLines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

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

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('prep')
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('stopped')
  const [lyrics, setLyrics] = useState(SAMPLE_TEXT)
  const [pairImportMode, setPairImportMode] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
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
  const [gestureMessage, setGestureMessage] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [prepEditorTab, setPrepEditorTab] = useState<PrepEditorTab>('text')
  const [syncMode, setSyncMode] = useState<SyncMode>('auto')
  const [manualStarts, setManualStarts] = useState<number[]>([])
  const [timingCursor, setTimingCursor] = useState(0)
  const [timingNotice, setTimingNotice] = useState('')
  const [timeInputDrafts, setTimeInputDrafts] = useState<Record<number, string>>({})
  const [isPrepAudioPlaying, setIsPrepAudioPlaying] = useState(false)
  const [prepStateHydrated, setPrepStateHydrated] = useState(false)

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
    try {
      const raw = window.localStorage.getItem(PREP_STORAGE_KEY)
      if (!raw) {
        return
      }

      const persisted = JSON.parse(raw) as PrepPersistedState
      if (typeof persisted.lyrics === 'string') {
        setLyrics(persisted.lyrics)
      }
      if (typeof persisted.pairImportMode === 'boolean') {
        setPairImportMode(persisted.pairImportMode)
        setShowTranslation(persisted.pairImportMode)
      }
      if (persisted.syncMode === 'auto' || persisted.syncMode === 'manual') {
        setSyncMode(persisted.syncMode)
      }
      if (Array.isArray(persisted.manualStarts)) {
        const starts = persisted.manualStarts
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
        setManualStarts(starts)
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
    }

    try {
      window.localStorage.setItem(PREP_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Ignore persistence errors (private mode / storage limits).
    }
  }, [lyrics, normalizedManualStarts, pairImportMode, prepStateHydrated, syncMode])

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
    showTimingNotice(`Cue ${index + 1} en ${formatTimeWithCentiseconds(markedTime)}`)
  }, [cueDrafts.length, mutateManualStarts, readEditorTimeSec, showTimingNotice, timingCursor])

  const markEndAtCursor = useCallback(() => {
    if (cueDrafts.length === 0) {
      return
    }

    const index = clamp(timingCursor, 0, cueDrafts.length - 1)
    if (index >= cueDrafts.length - 1) {
      showTimingNotice('El último cue termina al final del audio.')
      return
    }

    const markedTime = clamp(readEditorTimeSec(), 0, Math.max(totalDurationRef.current, 0))

    mutateManualStarts((starts) => {
      starts[index + 1] = markedTime
    })

    setTimingCursor(index + 1)
    showTimingNotice(`Fin cue ${index + 1} en ${formatTimeWithCentiseconds(markedTime)}`)
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
        `Shift ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}s desde cue ${fromIndex + 1}`,
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
      showTimingNotice(`Cue ${index + 1} ajustado a ${formatTimeWithCentiseconds(bounded)}`)
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
  }, [audioUrl, cues.length, playbackRate, playheadSec, volume])

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

  const snapToActiveCue = useCallback(
    (behavior: ScrollBehavior) => {
      const stage = stageRef.current
      const lineNode = cueRefs.current[activeCueIndex]

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
    [activeCueIndex],
  )

  const returnToFollow = useCallback(() => {
    setPlaybackStatus('playing')
    snapToActiveCue('smooth')
  }, [snapToActiveCue])

  const enforceTranslationRepeatFloor = useCallback(() => {
    setRepeatTarget((current) => {
      if (typeof current === 'number' && current < 5) {
        showLoopToast('Repeticiones: x5')
        return 5
      }

      return current
    })
  }, [showLoopToast])

  const setTranslationVisibility = useCallback(
    (next: boolean, options?: { recenterLive: boolean }) => {
      setShowTranslation(next)

      if (next) {
        enforceTranslationRepeatFloor()
      }

      if (options?.recenterLive && viewMode === 'live') {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            snapToActiveCue('smooth')
          })
        })
      }
    },
    [enforceTranslationRepeatFloor, snapToActiveCue, viewMode],
  )

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

  const handleTranslationToggle = useCallback(() => {
    setTranslationVisibility(!showTranslation, { recenterLive: true })
  }, [setTranslationVisibility, showTranslation])

  const applyStudyMode = (mode: 'translated' | 'blind') => {
    if (mode === 'translated') {
      setTranslationVisibility(true)
      return
    }

    setTranslationVisibility(false)
  }

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
      showTimingNotice('Cambió el conteo de cues. Se regeneraron tiempos automáticos.')
    }

    setPairImportMode(next)
    setTranslationVisibility(next, { recenterLive: false })
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
      showTimingNotice('Cambió el conteo de cues. Se regeneraron tiempos automáticos.')
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

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }
    } else if (document.exitFullscreen) {
      await document.exitFullscreen()
    }
  }

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

    snapToActiveCue('smooth')
  }, [activeCueIndex, playbackStatus, snapToActiveCue, viewMode])

  useEffect(() => {
    if (viewMode !== 'live') {
      return
    }

    const timer = window.setTimeout(() => {
      snapToActiveCue('auto')
    }, 50)

    return () => {
      window.clearTimeout(timer)
    }
  }, [snapToActiveCue, viewMode])

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
              {isFullscreen ? 'Salir Fullscreen' : 'Fullscreen'}
            </button>
          </header>

          <div className="prep-grid">
            <div className="field prep-editor">
              <div className="field-header">
                <span>Texto / letras</span>
                <div className="chip-row compact prep-editor-tabs" role="tablist" aria-label="Editor de preparación">
                  <button
                    type="button"
                    className={prepEditorTab === 'text' ? 'chip is-active' : 'chip'}
                    onClick={() => setPrepEditorTab('text')}
                    data-interactive="true"
                  >
                    Editar texto
                  </button>
                  <button
                    type="button"
                    className={prepEditorTab === 'timing' ? 'chip is-active' : 'chip'}
                    onClick={() => setPrepEditorTab('timing')}
                    data-interactive="true"
                  >
                    Editar tiempos
                  </button>
                </div>
              </div>

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
                    <button
                      type="button"
                      className={pairImportMode ? 'chip' : 'chip is-active'}
                      onClick={() => handlePairImportModeChange(false)}
                      data-interactive="true"
                    >
                      1 línea = 1 cue
                    </button>
                    <button
                      type="button"
                      className={pairImportMode ? 'chip is-active' : 'chip'}
                      onClick={() => handlePairImportModeChange(true)}
                      data-interactive="true"
                    >
                      EN/ES alternado
                    </button>
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
                      {syncMode === 'manual' ? 'Sincronía manual activa' : 'Sincronía automática estimada'}
                    </p>
                    <div className="chip-row compact">
                      <button
                        type="button"
                        className={syncMode === 'auto' ? 'chip is-active' : 'chip'}
                        onClick={restoreAutoSync}
                        data-interactive="true"
                      >
                        Auto
                      </button>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => shiftFromCursor(-SHIFT_STEP_SEC)}
                        disabled={cueDrafts.length === 0}
                        data-interactive="true"
                      >
                        Shift -0.2s
                      </button>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => shiftFromCursor(SHIFT_STEP_SEC)}
                        disabled={cueDrafts.length === 0}
                        data-interactive="true"
                      >
                        Shift +0.2s
                      </button>
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
                        {isPrepAudioPlaying ? 'Pausa' : 'Play'}
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
                          <button
                            type="button"
                            className={index === timingCursor ? 'chip is-active' : 'chip'}
                            onClick={() => selectCueForTiming(index)}
                            data-interactive="true"
                          >
                            Cue {index + 1}
                          </button>
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
                    <p className="field-hint">Agrega texto para generar cues y empezar a sincronizar.</p>
                  )}

                  <div className="chip-row compact">
                    <button
                      type="button"
                      className="chip"
                      onClick={() => exportCurrentCues('vtt')}
                      disabled={cuesForEditor.length === 0}
                      data-interactive="true"
                    >
                      Exportar .vtt
                    </button>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => exportCurrentCues('srt')}
                      disabled={cuesForEditor.length === 0}
                      data-interactive="true"
                    >
                      Exportar .srt
                    </button>
                  </div>

                  {timingNotice && <p className="timing-notice">{timingNotice}</p>}
                </div>
              )}
            </div>

            <div className="panel-card">
              <p className="panel-title">Ritmo y repetición</p>

              <div className="chip-row" role="radiogroup" aria-label="Modo de estudio">
                <button
                  type="button"
                  className={showTranslation ? 'chip is-active' : 'chip'}
                  onClick={() => applyStudyMode('translated')}
                  data-interactive="true"
                >
                  Escucha con traducción
                </button>
                <button
                  type="button"
                  className={showTranslation ? 'chip' : 'chip is-active'}
                  onClick={() => applyStudyMode('blind')}
                  data-interactive="true"
                >
                  Escucha a ciegas
                </button>
              </div>

              <div className="chip-row" role="radiogroup" aria-label="Velocidad">
                {SPEED_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={playbackRate === option ? 'chip is-active' : 'chip'}
                    onClick={() => setPlaybackRate(option)}
                    data-interactive="true"
                  >
                    {option === 1 ? 'Normal' : `${option}x`}
                  </button>
                ))}
              </div>

              <div className="chip-row" role="radiogroup" aria-label="Repeticiones">
                {REPEAT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={repeatTarget === option ? 'chip is-active' : 'chip'}
                    onClick={() => applyRepeatTarget(option)}
                    data-interactive="true"
                  >
                    {option === 'inf' ? '∞' : `x${option}`}
                  </button>
                ))}
              </div>

              <label className="slider-field">
                <span>Volumen {Math.round(volume * 100)}%</span>
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
            </div>

            <div className="panel-card">
              <p className="panel-title">Legibilidad</p>

              <div className="chip-row" role="radiogroup" aria-label="Tamaño de texto">
                {PREVIEW_FONT_LEVELS.map((size, index) => (
                  <button
                    key={size}
                    type="button"
                    className={fontLevel === index ? 'chip is-active' : 'chip'}
                    onClick={() => setFontLevel(index)}
                    data-interactive="true"
                  >
                    A{index + 1}
                  </button>
                ))}
              </div>

              <div className="chip-row" role="radiogroup" aria-label="Espaciado">
                {(['compact', 'normal', 'relaxed'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={lineSpacing === option ? 'chip is-active' : 'chip'}
                    onClick={() => setLineSpacing(option)}
                    data-interactive="true"
                  >
                    {option === 'compact' ? 'Compacto' : option === 'normal' ? 'Normal' : 'Relajado'}
                  </button>
                ))}
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

            <div className="panel-card">
              <p className="panel-title">Audio (opcional)</p>

              <label className="audio-upload" data-interactive="true">
                <span>Cargar audio</span>
                <input type="file" accept="audio/*" onChange={handleAudioUpload} />
              </label>

              <p className="audio-name">{audioLabel}</p>

              {audioUrl && (
                <button className="ghost-button small" onClick={removeAudio} type="button" data-interactive="true">
                  Quitar audio
                </button>
              )}
            </div>
          </div>

          <footer className="prep-footer">
            <p>
              {cues.length} cues · {formatTime(totalDuration)} por vuelta · Sync {syncMode === 'manual' ? 'manual' : 'auto'} ·{' '}
              {repeatTarget === 'inf' ? '∞' : `x${repeatTarget}`}
            </p>
            <button className="primary-button" onClick={togglePlayback} type="button" data-interactive="true">
              Iniciar Live
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

              <button
                type="button"
                className={showTranslation ? 'chip is-active' : 'chip'}
                onClick={handleTranslationToggle}
                data-interactive="true"
              >
                ES: {showTranslation ? 'ON' : 'OFF'}
              </button>

              <button className="ghost-button small" onClick={toggleFullscreen} type="button" data-interactive="true">
                {isFullscreen ? 'Salir' : 'Full'}
              </button>
            </header>
          )}

          <div className="teleprompter-stage" ref={stageRef} onScroll={handleStageScroll}>
            <div className="cue-list" style={{ '--cue-font-size': `${FONT_LEVELS[fontLevel]}px` } as CSSProperties}>
              {cues.map((cue, index) => {
                const isActive = index === activeCueIndex
                const isPast = index < activeCueIndex
                const className = [
                  'cue-line',
                  isActive ? 'is-active' : '',
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
                      isActive
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
                {isActivePlayback ? 'Pausa' : 'Play'}
              </button>

              <div className="chip-row compact" role="radiogroup" aria-label="Velocidad" data-interactive="true">
                {SPEED_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={playbackRate === option ? 'chip is-active' : 'chip'}
                    onClick={() => setPlaybackRate(option)}
                    data-interactive="true"
                  >
                    {option === 1 ? 'Normal' : `${option}x`}
                  </button>
                ))}
              </div>

              <div className="chip-row compact" role="radiogroup" aria-label="Repeticiones" data-interactive="true">
                {REPEAT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={repeatTarget === option ? 'chip is-active' : 'chip'}
                    onClick={() => applyRepeatTarget(option)}
                    data-interactive="true"
                  >
                    {option === 'inf' ? '∞' : `x${option}`}
                  </button>
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

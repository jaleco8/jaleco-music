import {
  type CSSProperties,
  type ChangeEvent,
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
type RepeatTarget = 10 | 20 | 30 | 40 | 'inf'
type LineSpacing = 'compact' | 'normal' | 'relaxed'
type GestureMode = 'idle' | 'pending' | 'horizontal' | 'vertical'
type Cue = {
  id: number
  text: string
  start: number
  end: number
  duration: number
  weight: number
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
const REPEAT_OPTIONS: RepeatTarget[] = [10, 20, 30, 40, 'inf']
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

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const splitLines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

const formatTime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

const buildCues = (lines: string[], totalDuration?: number): Cue[] => {
  if (lines.length === 0) {
    return []
  }

  const weights = lines.map((line) => Math.max(1, line.split(/\s+/).filter(Boolean).length))

  if (totalDuration && totalDuration > 0) {
    const totalWeight = weights.reduce((sum, value) => sum + value, 0)
    let cursor = 0

    return lines.map((line, index) => {
      const duration = (weights[index] / totalWeight) * totalDuration
      const start = cursor
      const end = index === lines.length - 1 ? totalDuration : start + duration
      cursor = end

      return {
        id: index,
        text: line,
        start,
        end,
        duration: end - start,
        weight: weights[index],
      }
    })
  }

  let cursor = 0

  return lines.map((line, index) => {
    const duration = clamp(weights[index] * 0.5, 1.1, 5.4)
    const start = cursor
    const end = start + duration
    cursor = end

    return {
      id: index,
      text: line,
      start,
      end,
      duration,
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

  const stageRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cueRefs = useRef<Array<HTMLParagraphElement | null>>([])
  const autoScrollFlagRef = useRef(false)
  const hideControlsTimerRef = useRef<number | null>(null)
  const loopToastTimerRef = useRef<number | null>(null)
  const gestureMessageTimerRef = useRef<number | null>(null)
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

  const lines = useMemo(() => splitLines(lyrics), [lyrics])

  const cues = useMemo(
    () => buildCues(lines, audioDurationSec > 0 ? audioDurationSec : undefined),
    [audioDurationSec, lines],
  )

  const totalDuration = cues.length > 0 ? cues[cues.length - 1].end : 0

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

    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
  }, [])

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

  const handleLyricsChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setLyrics(event.target.value)
    setPlayheadSec(0)
    setCompletedLoops(0)
    completedLoopsRef.current = 0
    setPlaybackStatus('stopped')
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

    setCountdownValue(3)
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
      finishPass()
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [finishPass])

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
            <label className="field">
              <span>Texto / letras</span>
              <textarea
                value={lyrics}
                onChange={handleLyricsChange}
                placeholder="Escribe una línea por frase"
                data-interactive="true"
              />
            </label>

            <div className="panel-card">
              <p className="panel-title">Ritmo y repetición</p>

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
                    onClick={() => setRepeatTarget(option)}
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
              {cues.length} cues · {formatTime(totalDuration)} por vuelta · {repeatTarget === 'inf' ? '∞' : `x${repeatTarget}`}
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

          <aside className="line-indicator" aria-hidden="true">
            <span style={{ transform: `translateY(${passProgress * 100}%)` }} />
          </aside>

          {controlsVisible && (
            <header className="live-header" data-interactive="true">
              <button className="ghost-button small" onClick={() => setViewMode('prep')} type="button" data-interactive="true">
                Preparación
              </button>

              <div className="repeat-badge" data-interactive="true">
                <strong>{repeatTarget === 'inf' ? '∞' : `x${repeatTarget}`}</strong>
                {remainingLoops !== null && <small>Restan: {remainingLoops}</small>}
              </div>

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
                    {cue.text}
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
                    onClick={() => setRepeatTarget(option)}
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

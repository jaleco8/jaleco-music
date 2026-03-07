import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useContentStore } from '@/stores/useContentStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useProgressStore } from '@/stores/useProgressStore'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { useCueSync } from '@/hooks/useCueSync'
import { useGestures } from '@/hooks/useGestures'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { CueDisplay } from '@/components/CueDisplay'
import { AudioControls } from '@/components/AudioControls'
import { ProgressRing } from '@/components/ProgressRing'
import { Button } from '@/components/ui/Button'
import { UiIcon } from '@/components/ui/Icons'
import { buildCues } from '@/lib/cueBuilder'
import { formatTime } from '@/lib/timingEngine'
import { FONT_LEVELS, LINE_HEIGHTS } from '@/types'

export default function LessonLivePage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const navigate = useNavigate()

  const lessonsByCourse = useContentStore((s) => s.lessonsByCourse)

  const studyMode = useSettingsStore((s) => s.studyMode)
  const blindMode = useSettingsStore((s) => s.blindMode)
  const playbackRate = useSettingsStore((s) => s.playbackRate)
  const repeatTarget = useSettingsStore((s) => s.repeatTarget)
  const volume = useSettingsStore((s) => s.volume)
  const fontLevel = useSettingsStore((s) => s.fontLevel)
  const lineSpacing = useSettingsStore((s) => s.lineSpacing)
  const focusMode = useSettingsStore((s) => s.focusMode)
  const countdownEnabled = useSettingsStore((s) => s.countdownEnabled)
  const hapticEnabled = useSettingsStore((s) => s.hapticEnabled)
  const darkMode = useSettingsStore((s) => s.darkMode)
  const setFontLevel = useSettingsStore((s) => s.setFontLevel)
  const setVolume = useSettingsStore((s) => s.setVolume)
  const setPlaybackRate = useSettingsStore((s) => s.setPlaybackRate)
  const setRepeatTarget = useSettingsStore((s) => s.setRepeatTarget)

  const recordLoopCompletion = useProgressStore((s) => s.recordLoopCompletion)

  const lessons = courseId ? (lessonsByCourse[courseId] ?? []) : []
  const lessonData = lessons.find((l) => l.lesson.id === lessonId)

  const [showCelebration, setShowCelebration] = useState(false)

  const cues = useMemo(() => {
    if (!lessonData) return []
    return buildCues(lessonData.cues)
  }, [lessonData])

  const audioUrl = useMemo(() => {
    if (!lessonData) return null
    return studyMode === 'interactive' && lessonData.audioInteractiveUrl
      ? lessonData.audioInteractiveUrl
      : lessonData.audioNormalUrl
  }, [lessonData, studyMode])

  const fullLessonId = courseId && lessonId ? `${courseId}/${lessonId}` : ''
  const numericTarget = repeatTarget === 'inf' ? Infinity : repeatTarget

  const handleLoopComplete = useCallback((_loopNumber: number) => {
    if (courseId) {
      recordLoopCompletion(fullLessonId, courseId, numericTarget)
    }
  }, [fullLessonId, courseId, numericTarget, recordLoopCompletion])

  const handleSessionComplete = useCallback(() => {
    setShowCelebration(true)
  }, [])

  const {
    playbackStatus,
    playheadSec,
    completedLoops,
    countdownValue,
    totalDuration,
    audioRef,
    togglePlayback,
    seekTo,
    seekBy,
    seekToAdjacentCue,
    resetSession,
    setPlaybackStatus,
    setControlsVisible,
    controlsVisible,
    loopToast,
  } = useAudioPlayer({
    audioUrl,
    cues,
    playbackRate,
    volume,
    repeatTarget,
    countdownEnabled,
    onLoopComplete: handleLoopComplete,
    onSessionComplete: handleSessionComplete,
  })

  const stageRef = useRef<HTMLDivElement>(null)
  const cueRefs = useRef<Array<HTMLParagraphElement | null>>([])

  const {
    activeCueIndex,
    focusCueIndex,
    currentCueProgress,
    passProgress,
    handleStageScroll,
    returnToFollow,
  } = useCueSync({
    cues,
    playheadSec,
    playbackStatus,
    studyMode,
    focusMode,
    hapticEnabled,
    stageRef,
    cueRefs,
    setPlaybackStatus,
  })

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    gestureMessage,
  } = useGestures({
    seekTo,
    seekBy,
    togglePlayback,
    totalDuration,
    playheadSec,
    fontLevel,
    setFontLevel,
    setControlsVisible,
    playbackStatus,
    setPlaybackStatus,
  })

  useKeyboardShortcuts({
    active: true,
    togglePlayback,
    seekToAdjacentCue,
    volume,
    setVolume,
    setControlsVisible: (v) => setControlsVisible(v as boolean),
  })

  const handleBack = () => {
    resetSession()
    navigate(`/course/${courseId}/lesson/${lessonId}/prep`)
  }

  const isPlaying = playbackStatus === 'playing' || playbackStatus === 'exploring'
  const fontSize = FONT_LEVELS[fontLevel] ?? 36
  const lineHeight = LINE_HEIGHTS[lineSpacing]

  const loopProgress = repeatTarget === 'inf'
    ? 0
    : Math.min(completedLoops / repeatTarget, 1)

  if (!lessonData) {
    return (
      <div className="app-shell min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[var(--text-main)] mb-2">Leccion no encontrada</h2>
          <Button variant="ghost" onClick={() => navigate(`/course/${courseId}`)}>Volver al curso</Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`app-shell min-h-dvh relative overflow-hidden select-none ${darkMode ? '' : 'theme-light'}`}
      style={{ '--line-height': lineHeight } as CSSProperties}
    >
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--surface)] z-30">
        <div
          className="h-full bg-[var(--accent)] transition-all duration-100"
          style={{ width: `${passProgress * 100}%` }}
        />
      </div>

      {/* Top header (visible when controls are visible) */}
      <header
        className={`
          absolute top-0 left-0 right-0 z-20 px-4 py-3
          flex items-center justify-between
          bg-gradient-to-b from-[var(--bg-top)] to-transparent
          transition-opacity duration-200
          ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        data-interactive="true"
      >
        <Button variant="icon" size="sm" onClick={handleBack} aria-label="Volver">
          <UiIcon name="back" size={20} />
        </Button>

        <div className="text-center flex-1 min-w-0">
          <p className="text-xs text-[var(--text-muted)] truncate">{lessonData.lesson.title}</p>
          <p className="text-xs text-[var(--text-muted)]">
            {repeatTarget === 'inf' ? `Reps: ${completedLoops + 1}` : `${completedLoops}/${repeatTarget} reps`}
            {' · '}{playbackRate}x
            {' · '}{activeCueIndex + 1}/{cues.length}
          </p>
        </div>

        <ProgressRing
          value={loopProgress}
          size={40}
          strokeWidth={3}
          className="shrink-0"
        />
      </header>

      {/* Main stage */}
      <div
        ref={stageRef}
        className="absolute inset-0 overflow-y-auto pt-16 pb-28"
        onScroll={handleStageScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: 'pan-y' }}
      >
        <div className="min-h-full flex flex-col justify-center px-6">
          <CueDisplay
            cues={cues}
            activeCueIndex={activeCueIndex}
            focusCueIndex={focusCueIndex}
            currentCueProgress={currentCueProgress}
            studyMode={studyMode}
            blindMode={blindMode}
            focusMode={focusMode}
            fontSize={fontSize}
            lineHeight={lineHeight}
            cueRefs={cueRefs}
          />
        </div>
      </div>

      {/* Exploring banner */}
      {playbackStatus === 'exploring' && (
        <div
          className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20"
          aria-live="polite"
        >
          <button
            onClick={returnToFollow}
            className="
              px-4 py-2 rounded-full text-sm font-medium
              bg-[var(--accent)] text-[var(--chip-active-text)]
              shadow-lg cursor-pointer
              active:scale-95 transition-transform
            "
          >
            Volver a seguir
          </button>
        </div>
      )}

      {/* Gesture feedback */}
      {gestureMessage && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
          aria-live="polite"
        >
          <div className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--surface-strong)] text-[var(--text-main)] text-sm font-medium shadow-lg">
            {gestureMessage}
          </div>
        </div>
      )}

      {/* Loop toast */}
      {loopToast && (
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none toast-enter"
          aria-live="polite"
        >
          <div className="px-4 py-2 rounded-full bg-[var(--surface-strong)] text-[var(--text-main)] text-sm font-medium shadow-lg border border-[var(--border-soft)]">
            {loopToast}
          </div>
        </div>
      )}

      {/* Countdown overlay */}
      {playbackStatus === 'countdown' && countdownValue > 0 && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
          <span className="text-7xl font-bold text-[var(--accent)] countdown-pop" key={countdownValue}>
            {countdownValue}
          </span>
        </div>
      )}

      {/* Control dock */}
      <AudioControls
        playbackStatus={playbackStatus}
        isPlaying={isPlaying}
        togglePlayback={togglePlayback}
        controlsVisible={controlsVisible}
        playheadSec={playheadSec}
        totalDuration={totalDuration}
        playbackRate={playbackRate}
        setPlaybackRate={setPlaybackRate}
        repeatTarget={repeatTarget}
        setRepeatTarget={setRepeatTarget}
        volume={volume}
        setVolume={setVolume}
        completedLoops={completedLoops}
        resetSession={resetSession}
        passProgress={passProgress}
      />

      {/* Celebration overlay */}
      {showCelebration && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 celebration-enter">
          <div className="text-center px-8 py-10 rounded-3xl bg-[var(--surface-strong)] border border-[var(--border-soft)] shadow-2xl max-w-sm mx-4">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-[var(--text-main)] mb-2">
              Leccion completada!
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-1">
              {completedLoops} repeticiones completadas
            </p>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Tiempo: {formatTime(totalDuration * completedLoops / playbackRate)}
            </p>

            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                onClick={() => navigate(`/course/${courseId}`)}
                className="w-full"
              >
                Volver al curso
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCelebration(false)
                  resetSession()
                }}
                className="w-full"
              >
                Practicar de nuevo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

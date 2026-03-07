import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Cue, PlaybackStatus, StudyMode } from '@/types'
import { clamp, classifyCueText } from '@/lib/cueBuilder'
import { LIVE_FOCUS_POINT } from '@/types'

interface UseCueSyncOptions {
  cues: Cue[]
  playheadSec: number
  playbackStatus: PlaybackStatus
  studyMode: StudyMode
  focusMode: boolean
  hapticEnabled: boolean
  stageRef: React.RefObject<HTMLDivElement | null>
  cueRefs: React.MutableRefObject<Array<HTMLParagraphElement | null>>
}

interface UseCueSyncReturn {
  activeCueIndex: number
  focusCueIndex: number
  currentCueProgress: number
  passProgress: number
  handleStageScroll: () => void
  returnToFollow: () => void
  setPlaybackStatus: (status: PlaybackStatus) => void
}

export function useCueSync({
  cues,
  playheadSec,
  playbackStatus,
  studyMode,
  focusMode: _focusMode,
  hapticEnabled,
  stageRef,
  cueRefs,
}: UseCueSyncOptions & { setPlaybackStatus: (status: PlaybackStatus) => void }): Omit<UseCueSyncReturn, 'setPlaybackStatus'> {
  const autoScrollFlagRef = useRef(false)
  const lastActiveCueRef = useRef(-1)
  const isActivePlayback = playbackStatus === 'playing' || playbackStatus === 'exploring'

  const totalDuration = cues.length > 0 ? cues[cues.length - 1].end : 0

  const activeCueIndex = useMemo(() => {
    if (cues.length === 0) return 0
    const found = cues.findIndex((cue) => playheadSec >= cue.start && playheadSec < cue.end)
    return found >= 0 ? found : cues.length - 1
  }, [cues, playheadSec])

  const cueKinds = useMemo(() => cues.map((cue) => classifyCueText(cue.text)), [cues])

  const focusCueIndex = useMemo(() => {
    if (cues.length === 0) return 0
    if (studyMode !== 'interactive') return activeCueIndex
    if (cueKinds[activeCueIndex] === 'question') return activeCueIndex

    const nextQuestionIndex = cueKinds.findIndex(
      (kind, index) => index > activeCueIndex && kind === 'question',
    )
    return nextQuestionIndex >= 0 ? nextQuestionIndex : activeCueIndex
  }, [activeCueIndex, cueKinds, cues.length, studyMode])

  const currentCueProgress = useMemo(() => {
    const cue = cues[activeCueIndex]
    if (!cue) return 0
    return clamp((playheadSec - cue.start) / Math.max(cue.duration, 0.001), 0, 1)
  }, [activeCueIndex, cues, playheadSec])

  const passProgress = totalDuration > 0 ? clamp(playheadSec / totalDuration, 0, 1) : 0

  const snapToFocusCue = useCallback((behavior: ScrollBehavior) => {
    const stage = stageRef.current
    const target = cueRefs.current[focusCueIndex]
    if (!stage || !target) return

    const stageRect = stage.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const offsetTop = targetRect.top - stageRect.top + stage.scrollTop
    const scrollTarget = offsetTop - stageRect.height * LIVE_FOCUS_POINT

    autoScrollFlagRef.current = true
    stage.scrollTo({ top: scrollTarget, behavior })

    window.setTimeout(() => { autoScrollFlagRef.current = false }, 200)
  }, [cueRefs, focusCueIndex, stageRef])

  // Auto-scroll on focus cue change
  useEffect(() => {
    if (playbackStatus !== 'playing') return
    snapToFocusCue('smooth')
  }, [focusCueIndex, playbackStatus, snapToFocusCue])

  // Initial snap
  useEffect(() => {
    const timer = window.setTimeout(() => snapToFocusCue('auto'), 50)
    return () => window.clearTimeout(timer)
  }, [snapToFocusCue])

  // Haptic feedback on cue change
  useEffect(() => {
    if (lastActiveCueRef.current === activeCueIndex) return

    const shouldVibrate =
      hapticEnabled && isActivePlayback && typeof navigator !== 'undefined' && 'vibrate' in navigator

    if (shouldVibrate && lastActiveCueRef.current >= 0) {
      navigator.vibrate(8)
    }

    lastActiveCueRef.current = activeCueIndex
  }, [activeCueIndex, hapticEnabled, isActivePlayback])

  const handleStageScroll = useCallback(() => {
    if (autoScrollFlagRef.current) return
    // Exploring mode handled externally via setPlaybackStatus
  }, [])

  const returnToFollow = useCallback(() => {
    snapToFocusCue('smooth')
  }, [snapToFocusCue])

  return {
    activeCueIndex,
    focusCueIndex,
    currentCueProgress,
    passProgress,
    handleStageScroll,
    returnToFollow,
  }
}

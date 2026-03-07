import { useCallback, useRef, useState, useEffect } from 'react'
import type { GestureState, PlaybackStatus } from '@/types'
import { DOUBLE_TAP_MS, FONT_LEVELS } from '@/types'
import { clamp } from '@/lib/cueBuilder'
import { formatTime } from '@/lib/timingEngine'

type TapSide = 'left' | 'center' | 'right'

interface UseGesturesOptions {
  seekTo: (time: number) => void
  seekBy: (delta: number) => void
  togglePlayback: () => void
  totalDuration: number
  playheadSec: number
  fontLevel: number
  setFontLevel: (v: number) => void
  setControlsVisible: (v: boolean | ((prev: boolean) => boolean)) => void
  playbackStatus: PlaybackStatus
  setPlaybackStatus: (v: PlaybackStatus) => void
}

interface UseGesturesReturn {
  handlePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  handlePointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  handlePointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  gestureMessage: string
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('[data-interactive="true"]'))
}

export function useGestures({
  seekTo,
  seekBy,
  togglePlayback: _togglePlayback,
  totalDuration,
  playheadSec,
  fontLevel,
  setFontLevel,
  setControlsVisible,
  playbackStatus,
  setPlaybackStatus,
}: UseGesturesOptions): UseGesturesReturn {
  const [gestureMessage, setGestureMessage] = useState('')
  const gestureStateRef = useRef<GestureState>({
    pointerId: null,
    startX: 0,
    startY: 0,
    startPlayhead: 0,
    startFontLevel: 0,
    mode: 'idle',
    moved: false,
  })
  const lastTapRef = useRef<{ time: number; side: TapSide }>({ time: 0, side: 'center' })
  const singleTapTimerRef = useRef<number | null>(null)
  const gestureMessageTimerRef = useRef<number | null>(null)

  const setGestureFeedback = useCallback((msg: string) => {
    setGestureMessage(msg)
    if (gestureMessageTimerRef.current !== null) window.clearTimeout(gestureMessageTimerRef.current)
    gestureMessageTimerRef.current = window.setTimeout(() => setGestureMessage(''), 600)
  }, [])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(event.target)) return

    gestureStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPlayhead: playheadSec,
      startFontLevel: fontLevel,
      mode: 'pending',
      moved: false,
    }
  }, [playheadSec, fontLevel])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const state = gestureStateRef.current
    if (state.pointerId !== event.pointerId || state.mode === 'idle') return

    const deltaX = event.clientX - state.startX
    const deltaY = event.clientY - state.startY
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (!state.moved && (absX > 8 || absY > 8)) state.moved = true

    if (state.mode === 'pending') {
      if (absX > 16 && absX > absY + 8) state.mode = 'horizontal'
      else if (absY > 44 && absY > absX + 12) state.mode = 'vertical'
    }

    if (state.mode === 'horizontal') {
      event.preventDefault()
      const width = (event.currentTarget as HTMLDivElement).clientWidth || 1
      const secondsDelta = (deltaX / width) * totalDuration
      seekTo(state.startPlayhead + secondsDelta)
      setGestureFeedback(`Ir a ${formatTime(state.startPlayhead + secondsDelta)}`)
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
  }, [totalDuration, seekTo, setGestureFeedback, setControlsVisible, fontLevel, setFontLevel])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const state = gestureStateRef.current
    if (state.pointerId !== event.pointerId) return

    if (state.mode === 'horizontal' || state.mode === 'vertical' || state.moved) {
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
    if (ratio < 0.34) side = 'left'
    else if (ratio > 0.66) side = 'right'

    const now = performance.now()
    const previousTap = lastTapRef.current

    // Double-tap detection
    if (side !== 'center' && previousTap.side === side && now - previousTap.time < DOUBLE_TAP_MS) {
      if (singleTapTimerRef.current !== null) window.clearTimeout(singleTapTimerRef.current)
      seekBy(side === 'left' ? -10 : 10)
      lastTapRef.current = { time: 0, side: 'center' }
      gestureStateRef.current.mode = 'idle'
      gestureStateRef.current.pointerId = null
      return
    }

    lastTapRef.current = { time: now, side }

    if (singleTapTimerRef.current !== null) window.clearTimeout(singleTapTimerRef.current)

    // Single tap: toggle controls; if exploring, return to follow
    singleTapTimerRef.current = window.setTimeout(() => {
      if (playbackStatus === 'exploring') {
        setPlaybackStatus('playing')
      }
      setControlsVisible((visible: boolean) => !visible)
    }, DOUBLE_TAP_MS)

    gestureStateRef.current.mode = 'idle'
    gestureStateRef.current.pointerId = null
  }, [seekBy, setControlsVisible, playbackStatus, setPlaybackStatus])

  // Cleanup
  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current !== null) window.clearTimeout(singleTapTimerRef.current)
      if (gestureMessageTimerRef.current !== null) window.clearTimeout(gestureMessageTimerRef.current)
    }
  }, [])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    gestureMessage,
  }
}

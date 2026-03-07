import { useCallback, useEffect, useRef, useState } from 'react'
import type { Cue, PlaybackStatus, RepeatTarget } from '@/types'
import { clamp } from '@/lib/cueBuilder'

interface UseAudioPlayerOptions {
  audioUrl: string | null
  cues: Cue[]
  playbackRate: number
  volume: number
  repeatTarget: RepeatTarget
  countdownEnabled: boolean
  onLoopComplete?: (loopNumber: number) => void
  onSessionComplete?: (totalLoops: number) => void
}

interface UseAudioPlayerReturn {
  playbackStatus: PlaybackStatus
  playheadSec: number
  completedLoops: number
  countdownValue: number
  totalDuration: number
  audioRef: React.RefObject<HTMLAudioElement | null>
  togglePlayback: () => void
  seekTo: (time: number) => void
  seekBy: (delta: number) => void
  seekToAdjacentCue: (direction: 1 | -1) => void
  resetSession: () => void
  setPlaybackStatus: (status: PlaybackStatus) => void
  setControlsVisible: (v: boolean | ((prev: boolean) => boolean)) => void
  controlsVisible: boolean
  loopToast: string
}

export function useAudioPlayer({
  audioUrl,
  cues,
  playbackRate,
  volume,
  repeatTarget,
  countdownEnabled,
  onLoopComplete,
  onSessionComplete,
}: UseAudioPlayerOptions): UseAudioPlayerReturn {
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('stopped')
  const [playheadSec, setPlayheadSec] = useState(0)
  const [completedLoops, setCompletedLoops] = useState(0)
  const [countdownValue, setCountdownValue] = useState(0)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [loopToast, setLoopToast] = useState('')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const endLockRef = useRef(false)
  const completedLoopsRef = useRef(0)
  const loopToastTimerRef = useRef<number | null>(null)
  const hideControlsTimerRef = useRef<number | null>(null)

  // Use refs for values accessed in RAF callbacks
  const repeatTargetRef = useRef(repeatTarget)
  const playbackRateRef = useRef(playbackRate)

  useEffect(() => { repeatTargetRef.current = repeatTarget }, [repeatTarget])
  useEffect(() => { playbackRateRef.current = playbackRate }, [playbackRate])

  const totalDuration = cues.length > 0 ? cues[cues.length - 1].end : 0
  const totalDurationRef = useRef(totalDuration)
  useEffect(() => { totalDurationRef.current = totalDuration }, [totalDuration])

  const isActivePlayback = playbackStatus === 'playing' || playbackStatus === 'exploring'

  const showLoopToast = useCallback((message: string) => {
    setLoopToast(message)
    if (loopToastTimerRef.current !== null) window.clearTimeout(loopToastTimerRef.current)
    loopToastTimerRef.current = window.setTimeout(() => setLoopToast(''), 900)
  }, [])

  const finishPass = useCallback(() => {
    if (endLockRef.current) return
    endLockRef.current = true

    const target = repeatTargetRef.current
    const nextCompleted = completedLoopsRef.current + 1
    const finite = target !== 'inf'
    const shouldRestart = !finite || nextCompleted < target

    if (shouldRestart) {
      completedLoopsRef.current = nextCompleted
      setCompletedLoops(nextCompleted)
      onLoopComplete?.(nextCompleted)

      const nextPass = nextCompleted + 1
      const toast = finite ? `Repeticion ${Math.min(nextPass, target)}/${target}` : `Repeticion ${nextPass}`
      showLoopToast(toast)

      setPlayheadSec(0)
      setPlaybackStatus('playing')

      const audio = audioRef.current
      if (audio && audioUrl) {
        audio.currentTime = 0
        void audio.play().catch(() => setPlaybackStatus('paused'))
      }
    } else {
      completedLoopsRef.current = nextCompleted
      setCompletedLoops(nextCompleted)
      setPlayheadSec(totalDurationRef.current)
      setPlaybackStatus('paused')
      onSessionComplete?.(nextCompleted)

      const audio = audioRef.current
      if (audio && audioUrl) audio.pause()
    }

    window.setTimeout(() => { endLockRef.current = false }, 120)
  }, [audioUrl, showLoopToast, onLoopComplete, onSessionComplete])

  const startPlaybackNow = useCallback(async () => {
    if (totalDurationRef.current <= 0 || cues.length === 0) return

    setPlaybackStatus('playing')
    setControlsVisible(true)

    const audio = audioRef.current
    if (audio && audioUrl) {
      audio.playbackRate = playbackRateRef.current
      audio.volume = volume
      audio.currentTime = clamp(playheadSec, 0, totalDurationRef.current)
      try { await audio.play() } catch { setPlaybackStatus('paused') }
    }
  }, [audioUrl, cues.length, playheadSec, volume])

  const togglePlayback = useCallback(() => {
    if (isActivePlayback) {
      setPlaybackStatus('paused')
      audioRef.current?.pause()
      return
    }

    if (playbackStatus === 'countdown') {
      setPlaybackStatus('paused')
      setCountdownValue(0)
      return
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
  }, [countdownEnabled, isActivePlayback, playbackStatus, playheadSec, startPlaybackNow])

  const seekTo = useCallback((time: number) => {
    const clamped = clamp(time, 0, totalDurationRef.current)
    setPlayheadSec(clamped)
    const audio = audioRef.current
    if (audio && audioUrl) audio.currentTime = clamped
  }, [audioUrl])

  const seekBy = useCallback((delta: number) => {
    setPlayheadSec((prev) => {
      const next = clamp(prev + delta, 0, totalDurationRef.current)
      const audio = audioRef.current
      if (audio && audioUrl) audio.currentTime = next
      return next
    })
  }, [audioUrl])

  const seekToAdjacentCue = useCallback((direction: 1 | -1) => {
    if (cues.length === 0) return
    const current = cues.findIndex((c) => playheadSec >= c.start && playheadSec < c.end)
    const idx = current >= 0 ? current : 0
    const target = clamp(idx + direction, 0, cues.length - 1)
    seekTo(cues[target].start)
  }, [cues, playheadSec, seekTo])

  const resetSession = useCallback(() => {
    setPlaybackStatus('stopped')
    setPlayheadSec(0)
    setCompletedLoops(0)
    completedLoopsRef.current = 0
    setCountdownValue(0)
    setLoopToast('')

    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
  }, [])

  // Countdown timer
  useEffect(() => {
    if (playbackStatus !== 'countdown') return

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

    return () => window.clearInterval(timer)
  }, [playbackStatus, startPlaybackNow])

  // Audio element event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onEnded = () => {
      if (isActivePlayback) finishPass()
    }

    const onLoadedMetadata = () => {
      // Audio duration loaded — handled externally if needed
    }

    audio.addEventListener('ended', onEnded)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)

    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
    }
  }, [finishPass, isActivePlayback])

  // Sync playback rate
  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.playbackRate = playbackRate
  }, [playbackRate])

  // Sync volume
  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = volume
  }, [volume])

  // RAF audio time sync (with audio file)
  useEffect(() => {
    if (!isActivePlayback || !audioUrl) return

    let rafId = 0
    const syncAudioTime = () => {
      const audio = audioRef.current
      if (audio) setPlayheadSec(audio.currentTime)
      rafId = window.requestAnimationFrame(syncAudioTime)
    }
    rafId = window.requestAnimationFrame(syncAudioTime)

    return () => window.cancelAnimationFrame(rafId)
  }, [audioUrl, isActivePlayback])

  // RAF simulated playback (without audio file)
  useEffect(() => {
    if (!isActivePlayback || audioUrl || totalDuration <= 0) return

    let rafId = 0
    let lastFrame = performance.now()

    const tick = (now: number) => {
      const delta = (now - lastFrame) / 1000
      lastFrame = now

      setPlayheadSec((previous) => {
        const next = previous + delta * playbackRateRef.current
        if (next >= totalDurationRef.current) {
          finishPass()
          return previous
        }
        return next
      })

      rafId = window.requestAnimationFrame(tick)
    }

    rafId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(rafId)
  }, [audioUrl, finishPass, isActivePlayback, totalDuration])

  // Auto-hide controls
  useEffect(() => {
    if (hideControlsTimerRef.current !== null) window.clearTimeout(hideControlsTimerRef.current)
    if (!controlsVisible || !isActivePlayback) return

    hideControlsTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false)
    }, 2600)

    return () => {
      if (hideControlsTimerRef.current !== null) window.clearTimeout(hideControlsTimerRef.current)
    }
  }, [controlsVisible, isActivePlayback])

  // Cleanup
  useEffect(() => {
    return () => {
      if (loopToastTimerRef.current !== null) window.clearTimeout(loopToastTimerRef.current)
      if (hideControlsTimerRef.current !== null) window.clearTimeout(hideControlsTimerRef.current)
    }
  }, [])

  return {
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
  }
}

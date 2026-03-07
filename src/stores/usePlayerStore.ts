import { create } from 'zustand'
import type { PlaybackStatus, LivePanel } from '@/types'

interface PlayerState {
  playbackStatus: PlaybackStatus
  playheadSec: number
  completedLoops: number
  controlsVisible: boolean
  livePanel: LivePanel
  countdownValue: number
  isFullscreen: boolean
  gestureMessage: string
  loopToast: string

  /* Actions */
  setPlaybackStatus: (v: PlaybackStatus) => void
  setPlayheadSec: (v: number) => void
  setCompletedLoops: (v: number) => void
  incrementLoops: () => void
  setControlsVisible: (v: boolean) => void
  setLivePanel: (v: LivePanel) => void
  setCountdownValue: (v: number) => void
  setIsFullscreen: (v: boolean) => void
  setGestureMessage: (v: string) => void
  setLoopToast: (v: string) => void
  resetSession: () => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  playbackStatus: 'stopped',
  playheadSec: 0,
  completedLoops: 0,
  controlsVisible: true,
  livePanel: null,
  countdownValue: 0,
  isFullscreen: false,
  gestureMessage: '',
  loopToast: '',

  setPlaybackStatus: (v) => set({ playbackStatus: v }),
  setPlayheadSec: (v) => set({ playheadSec: v }),
  setCompletedLoops: (v) => set({ completedLoops: v }),
  incrementLoops: () => set((s) => ({ completedLoops: s.completedLoops + 1 })),
  setControlsVisible: (v) => set({ controlsVisible: v }),
  setLivePanel: (v) => set({ livePanel: v }),
  setCountdownValue: (v) => set({ countdownValue: v }),
  setIsFullscreen: (v) => set({ isFullscreen: v }),
  setGestureMessage: (v) => set({ gestureMessage: v }),
  setLoopToast: (v) => set({ loopToast: v }),

  resetSession: () =>
    set({
      playbackStatus: 'stopped',
      playheadSec: 0,
      completedLoops: 0,
      controlsVisible: true,
      livePanel: null,
      countdownValue: 0,
      gestureMessage: '',
      loopToast: '',
    }),
}))

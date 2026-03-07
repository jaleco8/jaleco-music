import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LineSpacing, RepeatTarget, StudyMode, PresetKey, PresetConfig } from '@/types'
import { PRESET_CONFIGS } from '@/types'

interface SettingsState {
  /* Display */
  darkMode: boolean
  fontLevel: number
  lineSpacing: LineSpacing

  /* Audio */
  volume: number
  playbackRate: number

  /* Study */
  repeatTarget: RepeatTarget
  studyMode: StudyMode
  blindMode: boolean
  focusMode: boolean
  countdownEnabled: boolean
  hapticEnabled: boolean

  /* Onboarding */
  onboardingDismissed: boolean
  liveHelpDismissed: boolean

  /* Actions */
  setDarkMode: (v: boolean) => void
  setFontLevel: (v: number) => void
  setLineSpacing: (v: LineSpacing) => void
  setVolume: (v: number) => void
  setPlaybackRate: (v: number) => void
  setRepeatTarget: (v: RepeatTarget) => void
  setStudyMode: (v: StudyMode) => void
  setBlindMode: (v: boolean) => void
  setFocusMode: (v: boolean) => void
  setCountdownEnabled: (v: boolean) => void
  setHapticEnabled: (v: boolean) => void
  setOnboardingDismissed: (v: boolean) => void
  setLiveHelpDismissed: (v: boolean) => void
  applyPreset: (key: PresetKey) => void
  reset: () => void
}

const DEFAULTS = {
  darkMode: true,
  fontLevel: 1,
  lineSpacing: 'normal' as LineSpacing,
  volume: 1,
  playbackRate: 1,
  repeatTarget: 20 as RepeatTarget,
  studyMode: 'with-translation' as StudyMode,
  blindMode: false,
  focusMode: true,
  countdownEnabled: true,
  hapticEnabled: true,
  onboardingDismissed: false,
  liveHelpDismissed: false,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setDarkMode: (v) => set({ darkMode: v }),
      setFontLevel: (v) => set({ fontLevel: v }),
      setLineSpacing: (v) => set({ lineSpacing: v }),
      setVolume: (v) => set({ volume: v }),
      setPlaybackRate: (v) => set({ playbackRate: v }),
      setRepeatTarget: (v) => set({ repeatTarget: v }),
      setStudyMode: (v) => set({ studyMode: v }),
      setBlindMode: (v) => set({ blindMode: v }),
      setFocusMode: (v) => set({ focusMode: v }),
      setCountdownEnabled: (v) => set({ countdownEnabled: v }),
      setHapticEnabled: (v) => set({ hapticEnabled: v }),
      setOnboardingDismissed: (v) => set({ onboardingDismissed: v }),
      setLiveHelpDismissed: (v) => set({ liveHelpDismissed: v }),

      applyPreset: (key: PresetKey) => {
        const config: PresetConfig = PRESET_CONFIGS[key]
        set({
          studyMode: config.studyMode,
          blindMode: config.blindMode,
          playbackRate: config.playbackRate,
          repeatTarget: config.repeatTarget,
          ...(config.focusMode !== undefined ? { focusMode: config.focusMode } : {}),
          ...(config.countdownEnabled !== undefined ? { countdownEnabled: config.countdownEnabled } : {}),
        })
      },

      reset: () => set(DEFAULTS),
    }),
    {
      name: 'jaleco-settings',
    },
  ),
)

import { useEffect } from 'react'
import { KEYBOARD_VOLUME_STEP } from '@/types'

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || Boolean(target.closest('[contenteditable="true"]'))) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('[data-interactive="true"]'))
}

interface UseKeyboardShortcutsOptions {
  active: boolean
  togglePlayback: () => void
  seekToAdjacentCue: (direction: 1 | -1) => void
  volume: number
  setVolume: (v: number) => void
  setControlsVisible: (v: boolean) => void
}

export function useKeyboardShortcuts({
  active,
  togglePlayback,
  seekToAdjacentCue,
  volume,
  setVolume,
  setControlsVisible,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!active) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (isTextEntryTarget(event.target) || isInteractiveTarget(event.target)) return

      if (event.code === 'Space') {
        event.preventDefault()
        if (event.repeat) return
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
        setVolume(Math.min(1, volume + KEYBOARD_VOLUME_STEP))
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setVolume(Math.max(0, volume - KEYBOARD_VOLUME_STEP))
        return
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        if (document.fullscreenElement) {
          void document.exitFullscreen()
        } else {
          void document.documentElement.requestFullscreen()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, togglePlayback, seekToAdjacentCue, volume, setVolume, setControlsVisible])
}

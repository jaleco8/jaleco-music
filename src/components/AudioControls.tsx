import { useState } from 'react'
import type { PlaybackStatus, RepeatTarget, LivePanel } from '@/types'
import { SPEED_OPTIONS, REPEAT_OPTIONS } from '@/types'
import { formatTime } from '@/lib/timingEngine'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { UiIcon } from '@/components/ui/Icons'
import { Slider } from '@/components/ui/Slider'

interface AudioControlsProps {
  playbackStatus: PlaybackStatus
  isPlaying: boolean
  togglePlayback: () => void
  controlsVisible: boolean
  playheadSec: number
  totalDuration: number
  playbackRate: number
  setPlaybackRate: (v: number) => void
  repeatTarget: RepeatTarget
  setRepeatTarget: (v: RepeatTarget) => void
  volume: number
  setVolume: (v: number) => void
  completedLoops: number
  resetSession: () => void
  passProgress: number
}

export function AudioControls({
  playbackStatus,
  isPlaying,
  togglePlayback,
  controlsVisible,
  playheadSec,
  totalDuration,
  playbackRate,
  setPlaybackRate,
  repeatTarget,
  setRepeatTarget,
  volume,
  setVolume,
  completedLoops,
  resetSession,
  passProgress: _passProgress,
}: AudioControlsProps) {
  const [activePanel, setActivePanel] = useState<LivePanel>(null)

  const togglePanel = (panel: LivePanel) => {
    setActivePanel((current) => (current === panel ? null : panel))
  }

  return (
    <div
      className={`
        absolute bottom-0 left-0 right-0 z-20
        transition-all duration-200
        ${controlsVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
      `}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      data-interactive="true"
    >
      {/* Active panel (speed / repeat / more) */}
      {activePanel && (
        <div className="mx-4 mb-2 p-4 rounded-[var(--radius-md)] bg-[var(--surface-strong)] border border-[var(--border-soft)] shadow-xl">
          {activePanel === 'speed' && (
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-2 font-semibold uppercase tracking-wider">
                Velocidad
              </p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Velocidad">
                {SPEED_OPTIONS.map((speed) => (
                  <Chip
                    key={speed}
                    label={`${speed}x`}
                    active={playbackRate === speed}
                    onClick={() => setPlaybackRate(speed)}
                  />
                ))}
              </div>
            </div>
          )}

          {activePanel === 'repeat' && (
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-2 font-semibold uppercase tracking-wider">
                Repeticiones
              </p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Repeticiones">
                {REPEAT_OPTIONS.map((count) => (
                  <Chip
                    key={String(count)}
                    label={count === 'inf' ? '∞' : String(count)}
                    active={repeatTarget === count}
                    onClick={() => setRepeatTarget(count as RepeatTarget)}
                  />
                ))}
              </div>
            </div>
          )}

          {activePanel === 'more' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-2 font-semibold uppercase tracking-wider">
                  Volumen
                </p>
                <div className="flex items-center gap-3">
                  <UiIcon name="speaker" size={16} className="text-[var(--text-muted)]" />
                  <Slider min={0} max={1} step={0.05} value={volume} onChange={setVolume} className="flex-1" />
                  <span className="text-xs text-[var(--text-muted)] w-10 text-right">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Tiempo</span>
                <span className="text-[var(--text-main)] font-mono">
                  {formatTime(playheadSec)} / {formatTime(totalDuration)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Repeticiones</span>
                <span className="text-[var(--text-main)]">
                  {completedLoops}/{repeatTarget === 'inf' ? '∞' : repeatTarget}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetSession}
                  className="flex-1"
                >
                  <UiIcon name="reset" size={16} />
                  Reiniciar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (document.fullscreenElement) {
                      void document.exitFullscreen()
                    } else {
                      void document.documentElement.requestFullscreen()
                    }
                  }}
                  className="flex-1"
                >
                  <UiIcon name="fullscreen" size={16} />
                  Pantalla completa
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Control dock */}
      <div className="mx-4 mb-4 px-4 py-3 rounded-full bg-[var(--surface-strong)] border border-[var(--border-soft)] shadow-xl flex items-center justify-between gap-2">
        {/* Speed button */}
        <Button
          variant="icon"
          size="sm"
          onClick={() => togglePanel('speed')}
          className={activePanel === 'speed' ? 'text-[var(--accent)]' : ''}
          aria-label="Velocidad"
          aria-expanded={activePanel === 'speed'}
        >
          <span className="text-xs font-bold">{playbackRate}x</span>
        </Button>

        {/* Seek backward */}
        <Button variant="icon" size="sm" onClick={() => {}} aria-label="Retroceder">
          <UiIcon name="backward" size={20} />
        </Button>

        {/* Play / Pause */}
        <button
          onClick={togglePlayback}
          className="
            w-12 h-12 rounded-full flex items-center justify-center
            bg-[var(--accent)] text-[var(--chip-active-text)]
            shadow-lg cursor-pointer
            active:scale-90 transition-transform
          "
          aria-label={isPlaying ? 'Pausar' : playbackStatus === 'stopped' ? 'Reproducir' : 'Reanudar'}
        >
          <UiIcon name={isPlaying ? 'pause' : 'play'} size={22} />
        </button>

        {/* Seek forward */}
        <Button variant="icon" size="sm" onClick={() => {}} aria-label="Avanzar">
          <UiIcon name="forward" size={20} />
        </Button>

        {/* More button */}
        <Button
          variant="icon"
          size="sm"
          onClick={() => togglePanel('more')}
          className={activePanel === 'more' ? 'text-[var(--accent)]' : ''}
          aria-label="Mas opciones"
          aria-expanded={activePanel === 'more'}
        >
          <UiIcon name="settings" size={18} />
        </Button>
      </div>
    </div>
  )
}

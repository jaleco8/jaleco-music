import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AudioMode, CueDraft } from '@/types'
import type { LessonData } from '@/lib/contentLoader'
import { buildCues, buildManualCues, sanitizeManualStarts, clamp } from '@/lib/cueBuilder'
import {
  formatTimeWithCentiseconds,
  parseTimecode,
  serializeVtt,
  downloadTextFile,
} from '@/lib/timingEngine'
import { Button } from '@/components/ui/Button'
import { UiIcon } from '@/components/ui/Icons'

/* ── Types ── */

interface TimingEditorProps {
  lessonData: LessonData
  initialAudioMode: AudioMode
  /** Called immediately after saving so the player refreshes without reload */
  onSaved: (mode: AudioMode, starts: number[]) => void
  onClose: () => void
}

/* ── Controlled time input ── */

interface TimeInputProps {
  value: number
  onChange: (v: number) => void
  onFocus?: () => void
}

function TimeInput({ value, onChange, onFocus }: Readonly<TimeInputProps>) {
  const [text, setText] = useState(() => formatTimeWithCentiseconds(value))

  useEffect(() => {
    setText(formatTimeWithCentiseconds(value))
  }, [value])

  return (
    <input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={onFocus}
      onBlur={() => {
        const parsed = parseTimecode(text)
        if (parsed === null) {
          setText(formatTimeWithCentiseconds(value))
        } else {
          onChange(parsed)
          setText(formatTimeWithCentiseconds(parsed))
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      onClick={(e) => e.stopPropagation()}
      className="
        w-24 shrink-0 bg-[var(--surface)] border border-[var(--border-soft)]
        rounded-[var(--radius-sm)] px-1.5 py-0.5 text-xs text-center font-mono
        text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]
      "
    />
  )
}

/* ── Helpers ── */

function getDrafts(lessonData: LessonData, mode: AudioMode): CueDraft[] {
  return mode === 'normal'
    ? lessonData.cues.filter((c) => c.kind !== 'question')
    : lessonData.cues
}

function autoStartsFor(drafts: CueDraft[]): number[] {
  return buildCues(drafts).map((c) => c.start)
}

/* ── Main component ── */

export function TimingEditor({
  lessonData,
  initialAudioMode,
  onSaved,
  onClose,
}: Readonly<TimingEditorProps>) {
  const [editMode, setEditMode] = useState<AudioMode>(initialAudioMode)

  /* Pre-compute drafts for both modes */
  const normalDrafts = useMemo(() => getDrafts(lessonData, 'normal'), [lessonData])
  const interactiveDrafts = useMemo(() => getDrafts(lessonData, 'interactive'), [lessonData])

  /* Load initial starts from LessonData (parsed from VTT at startup) or auto-generate */
  const loadStarts = useCallback(
    (mode: AudioMode): number[] => {
      const drafts = mode === 'normal' ? normalDrafts : interactiveDrafts
      const saved = mode === 'normal' ? lessonData.timingNormal : lessonData.timingInteractive
      if (saved?.length === drafts.length) return [...saved]
      return autoStartsFor(drafts)
    },
    [lessonData, normalDrafts, interactiveDrafts],
  )

  const [normalStarts, setNormalStarts] = useState<number[]>(() => loadStarts('normal'))
  const [interactiveStarts, setInteractiveStarts] = useState<number[]>(() => loadStarts('interactive'))
  const [savedMode, setSavedMode] = useState<AudioMode | null>(null)
  const [hasUnsaved, setHasUnsaved] = useState(false)

  /* Audio state */
  const [playheadSec, setPlayheadSec] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioDuration, setAudioDuration] = useState(0)

  /* Selection */
  const [selectedCueIdx, setSelectedCueIdx] = useState(0)
  const [autoAdvance, setAutoAdvance] = useState(true)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef(0)
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])

  /* Derived */
  const editStarts = editMode === 'normal' ? normalStarts : interactiveStarts
  const setEditStarts = editMode === 'normal' ? setNormalStarts : setInteractiveStarts
  const drafts = editMode === 'normal' ? normalDrafts : interactiveDrafts
  const audioUrl = editMode === 'normal' ? lessonData.audioNormalUrl : lessonData.audioInteractiveUrl
  const hasInteractive = Boolean(lessonData.audioInteractiveUrl)

  /* Swap audio src and reset playhead when mode changes */
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleEmptied = () => {
      setIsPlaying(false)
      setPlayheadSec(0)
      setAudioDuration(0)
    }
    audio.addEventListener('emptied', handleEmptied)
    audio.pause()
    audio.src = audioUrl ?? ''
    audio.load() // fires 'emptied'

    return () => audio.removeEventListener('emptied', handleEmptied)
  }, [editMode]) // eslint-disable-line react-hooks/exhaustive-deps

  /* RAF sync */
  useEffect(() => {
    if (!isPlaying) return
    const sync = () => {
      const audio = audioRef.current
      if (audio) setPlayheadSec(audio.currentTime)
      rafRef.current = requestAnimationFrame(sync)
    }
    rafRef.current = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying])

  /* Auto-scroll selected row into view */
  useEffect(() => {
    rowRefs.current[selectedCueIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedCueIdx])

  /* Active cue by playhead */
  const activeCueIdx = useMemo(() => {
    if (editStarts.length === 0) return 0
    let last = 0
    for (let i = 0; i < editStarts.length; i++) {
      if (playheadSec >= editStarts[i]) last = i
      else break
    }
    return last
  }, [editStarts, playheadSec])

  /* Effective total duration */
  const effectiveDuration = audioDuration > 0
    ? audioDuration
    : (editStarts.at(-1) ?? 0) + 3

  /* Transport */
  const seekTo = useCallback((time: number) => {
    const clamped = clamp(time, 0, effectiveDuration)
    setPlayheadSec(clamped)
    const audio = audioRef.current
    if (audio) audio.currentTime = clamped
  }, [effectiveDuration])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      void audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => { /* no audio */ })
    }
  }, [isPlaying, audioUrl])

  /* Mark current cue */
  const mark = useCallback(() => {
    const newStarts = [...editStarts]
    newStarts[selectedCueIdx] = playheadSec
    setEditStarts(newStarts)
    setHasUnsaved(true)
    if (autoAdvance && selectedCueIdx < drafts.length - 1) {
      setSelectedCueIdx((i) => i + 1)
    }
  }, [editStarts, selectedCueIdx, playheadSec, setEditStarts, autoAdvance, drafts.length])

  /* Update a single start via time input */
  const updateStart = useCallback((idx: number, value: number) => {
    const newStarts = [...editStarts]
    newStarts[idx] = value
    setEditStarts(newStarts)
    setHasUnsaved(true)
  }, [editStarts, setEditStarts])

  /* Sanitize starts before saving */
  const sanitizedStarts = useCallback(
    (starts: number[], d: CueDraft[], dur: number) => {
      const fallback = autoStartsFor(d)
      return sanitizeManualStarts(starts, d.length, dur, fallback)
    },
    [],
  )

  /* Save: write VTT to filesystem via Vite dev plugin, then notify parent */
  const [isSaving, setIsSaving] = useState(false)
  const save = useCallback(async () => {
    const dur = effectiveDuration
    const clean = sanitizedStarts(editStarts, drafts, dur)
    setEditStarts(clean)

    const cues = buildManualCues(drafts, clean, dur)
    const content = serializeVtt(cues)
    const fileName = `timing-${editMode}.vtt`
    const relativePath = `${lessonData.contentRelativePath}/${fileName}`

    setIsSaving(true)
    try {
      const res = await fetch('/api/timing/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relativePath, content }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSavedMode(editMode)
      setHasUnsaved(false)
      onSaved(editMode, clean)
    } catch {
      // Fallback: if not in dev (e.g. static build), just download the file
      downloadTextFile(fileName, content)
      setSavedMode(editMode)
      setHasUnsaved(false)
      onSaved(editMode, clean)
    } finally {
      setIsSaving(false)
    }
  }, [effectiveDuration, editStarts, drafts, sanitizedStarts, setEditStarts, editMode, lessonData.contentRelativePath, onSaved])

  /* Export VTT download (manual backup) */
  const exportVtt = useCallback(() => {
    const dur = effectiveDuration
    const clean = sanitizedStarts(editStarts, drafts, dur)
    const cues = buildManualCues(drafts, clean, dur)
    downloadTextFile(`timing-${editMode}.vtt`, serializeVtt(cues))
  }, [effectiveDuration, editStarts, drafts, sanitizedStarts, editMode])

  /* Reset to auto-generated timing */
  const resetToAuto = useCallback(async () => {
    if (!globalThis.confirm('¿Restablecer los tiempos automáticos para este modo? Se perderán los ajustes manuales.')) return
    const autoStarts = autoStartsFor(drafts)
    setEditStarts(autoStarts)
    setHasUnsaved(false)
    setSavedMode(null)
    // Delete the VTT file on disk so the loader no longer picks it up
    const relativePath = `${lessonData.contentRelativePath}/timing-${editMode}.vtt`
    try {
      await fetch('/api/timing/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relativePath, content: '' }),
      })
    } catch { /* ignore in static / production */ }
    onSaved(editMode, autoStarts)
  }, [drafts, editMode, lessonData.contentRelativePath, setEditStarts, onSaved])

  /* Switch mode */
  const switchMode = useCallback((mode: AudioMode) => {
    setEditMode(mode)
    setSelectedCueIdx(0)
    setHasUnsaved(false)
    setSavedMode(null)
  }, [])

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ background: 'var(--bg-top)' }}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        onLoadedMetadata={() => {
          if (audioRef.current) setAudioDuration(audioRef.current.duration)
        }}
        onEnded={() => {
          setIsPlaying(false)
          setPlayheadSec(audioDuration)
        }}
      >
        {/* captions not applicable for timing-editor playback control */}
        <track kind="captions" />
      </audio>

      {/* Header */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--border-soft)]">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            Editar tiempos
          </p>
          <p className="text-sm font-semibold text-[var(--text-main)] truncate">
            {lessonData.lesson.title}
          </p>
        </div>

        {/* Save status */}
        {!hasUnsaved && savedMode === editMode && (
          <span className="text-xs text-[var(--state-success)] flex items-center gap-1 shrink-0">
            <UiIcon name="check" size={12} /> Guardado
          </span>
        )}
        {hasUnsaved && (
          <span className="text-xs text-[var(--state-warning)] shrink-0">Sin guardar</span>
        )}

        <Button variant="icon" size="sm" onClick={onClose} aria-label="Cerrar editor de tiempos">
          <UiIcon name="close" size={20} />
        </Button>
      </header>

      {/* Mode tabs */}
      {hasInteractive && (
        <div className="shrink-0 flex border-b border-[var(--border-soft)]">
          {(['normal', 'interactive'] as AudioMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => switchMode(mode)}
              className={`
                flex-1 py-2.5 text-sm font-medium transition-colors
                ${editMode === mode
                  ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}
              `}
            >
              {mode === 'normal' ? 'Audio Normal' : 'Audio Interactivo'}
            </button>
          ))}
        </div>
      )}

      {/* Cue list */}
      <div className="flex-1 overflow-y-auto">
        {drafts.length === 0 ? (
          <p className="text-center text-[var(--text-muted)] py-12 text-sm">Sin cues para este modo</p>
        ) : (
          drafts.map((draft, i) => {
            const isSelected = i === selectedCueIdx
            const isActive = i === activeCueIdx && isPlaying

            return (
              <button
                key={`${editMode}-${i}`}
                type="button"
                ref={(el) => { rowRefs.current[i] = el as HTMLDivElement | null }}
                onClick={() => {
                  setSelectedCueIdx(i)
                  seekTo(editStarts[i] ?? 0)
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setSelectedCueIdx(i); seekTo(editStarts[i] ?? 0) } }}
                className={`
                  w-full text-left flex items-center gap-3 px-4 py-2.5 cursor-pointer
                  border-b border-[var(--border-soft)]/20
                  transition-colors
                  ${isSelected ? 'bg-[var(--accent-soft)] outline-1 outline-[var(--accent)] outline-offset-[-1px]' : ''}
                  ${isActive && !isSelected ? 'bg-[var(--surface)]' : ''}
                `}
              >
                <span className="text-xs text-[var(--text-muted)] w-5 shrink-0 text-right font-mono">
                  {i + 1}
                </span>

                <TimeInput
                  value={editStarts[i] ?? 0}
                  onChange={(v) => updateStart(i, v)}
                  onFocus={() => setSelectedCueIdx(i)}
                />

                <span
                  className={`
                    flex-1 text-sm truncate min-w-0
                    ${draft.kind === 'question'
                      ? 'italic text-[var(--text-muted)]'
                      : 'text-[var(--text-main)]'}
                  `}
                >
                  {draft.text}
                </span>

                {draft.translation && (
                  <span className="text-xs text-[var(--text-muted)] truncate max-w-[30%] hidden sm:block">
                    {draft.translation}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Footer controls */}
      <div
        className="shrink-0 border-t border-[var(--border-soft)] px-4 py-3 space-y-3 bg-[var(--surface)]"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {/* Seek bar + times */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--text-muted)] w-16 text-right shrink-0">
            {formatTimeWithCentiseconds(playheadSec)}
          </span>
          <input
            type="range"
            min={0}
            max={audioDuration || 100}
            step={0.01}
            value={playheadSec}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="flex-1 accent-[#61f2c2] h-1 cursor-pointer"
          />
          <span className="text-[10px] font-mono text-[var(--text-muted)] w-16 shrink-0">
            {formatTimeWithCentiseconds(audioDuration)}
          </span>
        </div>

        {/* Transport controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="icon"
            size="sm"
            onClick={() => seekTo(playheadSec - 5)}
            aria-label="−5 segundos"
          >
            <UiIcon name="backward" size={18} />
          </Button>
          <Button
            variant="icon"
            onClick={togglePlay}
            disabled={!audioUrl}
            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            className="w-11 h-11"
          >
            <UiIcon name={isPlaying ? 'pause' : 'play'} size={22} />
          </Button>
          <Button
            variant="icon"
            size="sm"
            onClick={() => seekTo(playheadSec + 5)}
            aria-label="+5 segundos"
          >
            <UiIcon name="forward" size={18} />
          </Button>
        </div>

        {/* Mark + auto-advance */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={mark}
            className="
              flex-1 py-2.5 rounded-[var(--radius-sm)] font-bold text-sm
              bg-[var(--accent)] text-[var(--chip-active-text)]
              active:scale-95 transition-transform
            "
          >
            ● MARCAR cue {selectedCueIdx + 1}
          </button>
          <button
            type="button"
            onClick={() => setAutoAdvance((v) => !v)}
            title="Auto-avanzar al siguiente cue al marcar"
            className={`
              px-3 py-2.5 rounded-[var(--radius-sm)] text-xs font-medium
              border transition-colors
              ${autoAdvance
                ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]'
                : 'text-[var(--text-muted)] border-[var(--border-soft)]'}
            `}
          >
            Auto →
          </button>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => { void save() }}
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={exportVtt}
            title={`Descargar timing-${editMode}.vtt`}
          >
            <UiIcon name="forward" size={14} />
            VTT
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { void resetToAuto() }}
            title="Volver a tiempos automáticos"
          >
            <UiIcon name="reset" size={14} />
          </Button>
        </div>

        {/* Mode hint */}
        {!audioUrl && (
          <p className="text-center text-xs text-[var(--state-warning)]">
            Sin archivo de audio para este modo — puedes editar tiempos manualmente
          </p>
        )}
      </div>
    </div>
  )
}

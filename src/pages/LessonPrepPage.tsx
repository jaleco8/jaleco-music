import { useParams, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { useContentStore } from '@/stores/useContentStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useProgressStore } from '@/stores/useProgressStore'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { UiIcon } from '@/components/ui/Icons'
import { Slider } from '@/components/ui/Slider'
import { buildCues } from '@/lib/cueBuilder'
import {
  SPEED_OPTIONS,
  REPEAT_OPTIONS,
  PRESET_LABELS,
  PRESET_CONFIGS,
  MODE_HELP,
  PREVIEW_FONT_LEVELS,
  LINE_HEIGHTS,
  type PresetKey,
  type StudyMode,
  type RepeatTarget,
  type AudioMode,
} from '@/types'

export default function LessonPrepPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const navigate = useNavigate()

  const courses = useContentStore((s) => s.courses)
  const lessonsByCourse = useContentStore((s) => s.lessonsByCourse)
  const lessonProgress = useProgressStore((s) => s.lessonProgress)

  const studyMode = useSettingsStore((s) => s.studyMode)
  const blindMode = useSettingsStore((s) => s.blindMode)
  const playbackRate = useSettingsStore((s) => s.playbackRate)
  const repeatTarget = useSettingsStore((s) => s.repeatTarget)
  const volume = useSettingsStore((s) => s.volume)
  const fontLevel = useSettingsStore((s) => s.fontLevel)
  const lineSpacing = useSettingsStore((s) => s.lineSpacing)

  const setStudyMode = useSettingsStore((s) => s.setStudyMode)
  const setBlindMode = useSettingsStore((s) => s.setBlindMode)
  const setPlaybackRate = useSettingsStore((s) => s.setPlaybackRate)
  const setRepeatTarget = useSettingsStore((s) => s.setRepeatTarget)
  const setVolume = useSettingsStore((s) => s.setVolume)
  const applyPreset = useSettingsStore((s) => s.applyPreset)

  const course = courses.find((c) => c.id === courseId)
  const lessons = courseId ? (lessonsByCourse[courseId] ?? []) : []
  const lessonData = lessons.find((l) => l.lesson.id === lessonId)

  const cues = useMemo(() => {
    if (!lessonData) return []
    return buildCues(lessonData.cues)
  }, [lessonData])

  const fullLessonId = courseId && lessonId ? `${courseId}/${lessonId}` : ''
  const progress = lessonProgress[fullLessonId]
  const hasAudio = Boolean(lessonData?.audioNormalUrl || lessonData?.audioInteractiveUrl)

  if (!course || !lessonData) {
    return (
      <div className="app-shell min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[var(--text-main)] mb-2">Leccion no encontrada</h2>
          <Button variant="ghost" onClick={() => navigate(`/course/${courseId}`)}>Volver al curso</Button>
        </div>
      </div>
    )
  }

  const previewFontSize = PREVIEW_FONT_LEVELS[fontLevel] ?? 22
  const lineHeight = LINE_HEIGHTS[lineSpacing]

  const handleStartPractice = () => {
    if (cues.length === 0) return
    navigate(`/course/${courseId}/lesson/${lessonId}/live`)
  }

  const audioMode: AudioMode = studyMode === 'interactive' && lessonData.audioInteractiveUrl
    ? 'interactive'
    : 'normal'

  return (
    <div className="app-shell min-h-dvh">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32 fade-in"
        style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}
      >
        {/* Header */}
        <header className="mb-6">
          <Button
            variant="icon"
            size="sm"
            onClick={() => navigate(`/course/${courseId}`)}
            className="mb-3 -ml-2"
            aria-label="Volver al curso"
          >
            <UiIcon name="back" size={20} />
            <span className="text-sm">{course.title}</span>
          </Button>

          <h1 className="text-xl font-bold text-[var(--text-main)]">
            {lessonData.lesson.title}
          </h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <UiIcon name="clock" size={12} />
              {lessonData.lesson.estimatedMinutes} min
            </span>
            {lessonData.lesson.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border-soft)] text-[var(--text-muted)]"
              >
                {tag}
              </span>
            ))}
            {progress && progress.completedLoops > 0 && (
              <>
                <span className="opacity-40">|</span>
                <span>{progress.completedLoops} reps completadas</span>
              </>
            )}
          </div>
        </header>

        {/* Text Preview */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Vista previa del texto
          </h2>
          <div
            className="p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border-soft)] max-h-52 overflow-y-auto"
            style={{ fontSize: previewFontSize, lineHeight }}
          >
            {cues.length === 0 ? (
              <p className="text-[var(--text-muted)] italic">Sin contenido de texto</p>
            ) : (
              cues.slice(0, 6).map((cue, i) => (
                <div key={i} className="mb-2">
                  <p className="text-[var(--text-main)]">{cue.text}</p>
                  {cue.translation && studyMode !== 'without-translation' && (
                    <p className="text-[var(--text-muted)] text-sm mt-0.5">{cue.translation}</p>
                  )}
                </div>
              ))
            )}
            {cues.length > 6 && (
              <p className="text-[var(--text-muted)] text-sm italic">
                ...y {cues.length - 6} lineas mas
              </p>
            )}
          </div>
        </section>

        {/* Presets */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Presets de estudio
          </h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Presets">
            {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => {
              const config = PRESET_CONFIGS[key]
              const isActive =
                config.studyMode === studyMode &&
                config.blindMode === blindMode &&
                config.playbackRate === playbackRate &&
                config.repeatTarget === repeatTarget
              return (
                <Chip
                  key={key}
                  label={PRESET_LABELS[key]}
                  active={isActive}
                  onClick={() => applyPreset(key)}
                />
              )
            })}
          </div>
        </section>

        {/* Audio Mode */}
        {hasAudio && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Tipo de audio
            </h2>
            <div className="flex gap-2" role="radiogroup" aria-label="Modo de audio">
              <Chip
                label="Normal"
                active={audioMode === 'normal'}
                onClick={() => {
                  if (studyMode === 'interactive') setStudyMode('with-translation')
                }}
              />
              <Chip
                label="Interactivo"
                active={audioMode === 'interactive'}
                onClick={() => setStudyMode('interactive')}
                disabled={!lessonData.audioInteractiveUrl}
              />
            </div>
          </section>
        )}

        {/* Study Mode */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Modo de estudio
          </h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Modo de estudio">
            {(['with-translation', 'without-translation', 'interactive'] as StudyMode[]).map((mode) => (
              <Chip
                key={mode}
                label={
                  mode === 'with-translation' ? 'Con traduccion' :
                  mode === 'without-translation' ? 'Sin traduccion' :
                  'Interactivo'
                }
                active={studyMode === mode}
                onClick={() => setStudyMode(mode)}
              />
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">{MODE_HELP[studyMode]}</p>

          <div className="mt-3">
            <Chip
              label="Modo a ciegas"
              active={blindMode}
              onClick={() => setBlindMode(!blindMode)}
              role="checkbox"
            />
            {blindMode && (
              <p className="text-xs text-[var(--text-muted)] mt-1">{MODE_HELP.blind}</p>
            )}
          </div>
        </section>

        {/* Speed */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Velocidad
          </h2>
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
        </section>

        {/* Repetitions */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Repeticiones
          </h2>
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
        </section>

        {/* Volume */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Volumen
          </h2>
          <div className="flex items-center gap-3">
            <UiIcon name="speaker" size={16} className="text-[var(--text-muted)]" />
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={setVolume}
              className="flex-1"
            />
            <span className="text-xs text-[var(--text-muted)] w-10 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </section>
      </div>

      {/* Sticky CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[var(--bg-bottom)] via-[var(--bg-bottom)] to-transparent"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-2 px-1">
            <span>{cues.length} frases · {repeatTarget === 'inf' ? '∞' : repeatTarget} reps · {playbackRate}x</span>
            {hasAudio && (
              <span className="flex items-center gap-1">
                <UiIcon name="speaker" size={12} />
                Audio {audioMode}
              </span>
            )}
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={handleStartPractice}
            disabled={cues.length === 0}
            className="w-full"
          >
            Comenzar practica
          </Button>
        </div>
      </div>
    </div>
  )
}

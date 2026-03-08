import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useProgressStore } from '@/stores/useProgressStore'
import { useContentStore } from '@/stores/useContentStore'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { UiIcon } from '@/components/ui/Icons'
import { Slider } from '@/components/ui/Slider'
import { FONT_LEVELS, type LineSpacing } from '@/types'
import { useState } from 'react'

export default function SettingsPage() {
  const navigate = useNavigate()
  const courses = useContentStore((s) => s.courses)
  const course = courses[0]

  const darkMode = useSettingsStore((s) => s.darkMode)
  const fontLevel = useSettingsStore((s) => s.fontLevel)
  const lineSpacing = useSettingsStore((s) => s.lineSpacing)
  const countdownEnabled = useSettingsStore((s) => s.countdownEnabled)
  const hapticEnabled = useSettingsStore((s) => s.hapticEnabled)
  const volume = useSettingsStore((s) => s.volume)

  const setDarkMode = useSettingsStore((s) => s.setDarkMode)
  const setFontLevel = useSettingsStore((s) => s.setFontLevel)
  const setLineSpacing = useSettingsStore((s) => s.setLineSpacing)
  const setCountdownEnabled = useSettingsStore((s) => s.setCountdownEnabled)
  const setHapticEnabled = useSettingsStore((s) => s.setHapticEnabled)
  const setVolume = useSettingsStore((s) => s.setVolume)
  const resetSettings = useSettingsStore((s) => s.reset)

  const clearAllProgress = useProgressStore((s) => s.clearAllProgress)

  const [confirmClear, setConfirmClear] = useState(false)

  const handleClearData = async () => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    await clearAllProgress()
    resetSettings()
    setConfirmClear(false)
  }

  return (
    <div className="app-shell min-h-dvh">
      <div className="max-w-lg mx-auto px-4 py-6 pb-24 fade-in"
        style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}
      >
        {/* Header */}
        <header className="mb-8">
          <Button
            variant="icon"
            size="sm"
            onClick={() => navigate('/')}
            className="mb-3 -ml-2"
            aria-label="Volver al inicio"
          >
            <UiIcon name="back" size={20} />
            <span className="text-sm">Inicio</span>
          </Button>
          <h1 className="text-xl font-bold text-[var(--text-main)]">Configuracion</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Preferencias de la app</p>
        </header>

        {/* Language */}
        {course && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Idioma
            </h2>
            <div
              className="p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border-soft)]"
            >
              <div className="flex items-center gap-3">
                <UiIcon name="speaker" size={20} className="text-[var(--text-muted)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--text-main)]">
                    {course.language.target.toUpperCase()} / {course.language.native.toUpperCase()}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{course.title}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Theme */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Apariencia
          </h2>
          <div
            className="p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border-soft)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UiIcon name={darkMode ? 'moon' : 'sun'} size={20} className="text-[var(--text-muted)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--text-main)]">Tema</p>
                  <p className="text-xs text-[var(--text-muted)]">{darkMode ? 'Oscuro' : 'Claro'}</p>
                </div>
              </div>
              <Chip
                label={darkMode ? 'Oscuro' : 'Claro'}
                active={darkMode}
                onClick={() => setDarkMode(!darkMode)}
                role="checkbox"
              />
            </div>
          </div>
        </section>

        {/* Font Size */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Tamano de fuente
          </h2>
          <div className="flex gap-2" role="radiogroup" aria-label="Tamano de fuente">
            {FONT_LEVELS.map((size, idx) => (
              <Chip
                key={size}
                label={`${size}px`}
                active={fontLevel === idx}
                onClick={() => setFontLevel(idx)}
              />
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Tamano del texto durante la practica en vivo.
          </p>
        </section>

        {/* Line Spacing */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Espaciado de linea
          </h2>
          <div className="flex gap-2" role="radiogroup" aria-label="Espaciado de linea">
            {(['compact', 'normal', 'relaxed'] as LineSpacing[]).map((spacing) => (
              <Chip
                key={spacing}
                label={spacing === 'compact' ? 'Compacto' : spacing === 'normal' ? 'Normal' : 'Relajado'}
                active={lineSpacing === spacing}
                onClick={() => setLineSpacing(spacing)}
              />
            ))}
          </div>
        </section>

        {/* Volume */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Volumen por defecto
          </h2>
          <div className="flex items-center gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border-soft)]">
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

        {/* Toggles */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Comportamiento
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border-soft)]">
              <div>
                <p className="text-sm font-medium text-[var(--text-main)]">Cuenta regresiva</p>
                <p className="text-xs text-[var(--text-muted)]">Muestra 3-2-1 antes de iniciar</p>
              </div>
              <Chip
                label={countdownEnabled ? 'On' : 'Off'}
                active={countdownEnabled}
                onClick={() => setCountdownEnabled(!countdownEnabled)}
                role="checkbox"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border-soft)]">
              <div>
                <p className="text-sm font-medium text-[var(--text-main)]">Vibracion</p>
                <p className="text-xs text-[var(--text-muted)]">Feedback haptico al cambiar frase</p>
              </div>
              <Chip
                label={hapticEnabled ? 'On' : 'Off'}
                active={hapticEnabled}
                onClick={() => setHapticEnabled(!hapticEnabled)}
                role="checkbox"
              />
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Datos
          </h2>
          <div className="p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-red-500/30">
            <p className="text-sm font-medium text-[var(--text-main)] mb-1">Borrar todo el progreso</p>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Elimina las repeticiones, streaks y configuracion guardada. Esta accion no se puede deshacer.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearData}
              className="text-red-400 border-red-500/30 hover:bg-red-500/10"
            >
              <UiIcon name="trash" size={16} />
              {confirmClear ? 'Confirmar: borrar todo' : 'Borrar progreso'}
            </Button>
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Acerca de
          </h2>
          <div className="p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border-soft)]">
            <p className="text-sm font-bold text-[var(--text-main)]">Jaleco</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              App de aprendizaje de idiomas por repeticion auditiva y lectura sincronizada.
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Version 2.0</p>
          </div>
        </section>
      </div>
    </div>
  )
}

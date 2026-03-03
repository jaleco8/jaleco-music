import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import StudyExperience from './StudyExperience'
import './App.css'

type Role = 'STANDARD' | 'ADMIN'
type UiToastTone = 'info' | 'success' | 'warning' | 'error'
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
type User = { email: string; role: Role }
type Chapter = { id: string; title: string; sections: { id: string; title: string }[] }
type ReviewCard = { id: string; en: string; es: string; start?: number; end?: number }
type ReviewFeedback = '' | 'known' | 'unknown'
type UiToast = { id: string; tone: UiToastTone; message: string }
type AuthFormState = { email: string; password: string; error: string }

const SESSION_KEY = 'jaleco-music:session:v1'
const CONTENT_KEY = 'jaleco-music:active-content:v1'
const SETTINGS_KEY = 'jaleco-music:settings:v1'

const CHAPTERS: Chapter[] = [
  {
    id: 'ch-1',
    title: 'Capítulo 1 · Fundamentos',
    sections: [
      { id: 's-1', title: 'Sección 1 · Intro' },
      { id: 's-2', title: 'Sección 2 · Ritmo' },
    ],
  },
  {
    id: 'ch-2',
    title: 'Capítulo 2 · Conversación',
    sections: [
      { id: 's-3', title: 'Sección 3 · Preguntas' },
      { id: 's-4', title: 'Sección 4 · Respuestas' },
    ],
  },
]

const REVIEW_QUEUE: ReviewCard[] = [
  { id: '1', en: 'Take a deep breath.', es: 'Respira profundo.', start: 2, end: 4 },
  { id: '2', en: 'Stay on the beat.', es: 'Mantén el ritmo.', start: 5, end: 7 },
  { id: '3', en: 'Repeat with intention.', es: 'Repite con intención.' },
]

const getInitialPath = () => window.location.pathname || '/auth'
const createToastId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function App() {
  const [path, setPath] = useState(getInitialPath)
  const [user, setUser] = useState<User | null>(null)
  const [appHydrated, setAppHydrated] = useState(false)
  const [chapterId, setChapterId] = useState(CHAPTERS[0].id)
  const [sectionId, setSectionId] = useState(CHAPTERS[0].sections[0].id)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerChapterId, setPickerChapterId] = useState(CHAPTERS[0].id)
  const [pickerSectionId, setPickerSectionId] = useState(CHAPTERS[0].sections[0].id)
  const [studyHour, setStudyHour] = useState('20:00')
  const [phrasesPerDay, setPhrasesPerDay] = useState(15)
  const [studyHourDraft, setStudyHourDraft] = useState('20:00')
  const [phrasesPerDayDraft, setPhrasesPerDayDraft] = useState(15)
  const [settingsSaveState, setSettingsSaveState] = useState<SaveState>('idle')
  const [authForm, setAuthForm] = useState<AuthFormState>({
    email: 'demo@jaleco.app',
    password: '123456',
    error: '',
  })
  const [authFieldErrors, setAuthFieldErrors] = useState({ email: '', password: '' })
  const [reviewQueue, setReviewQueue] = useState<ReviewCard[]>(REVIEW_QUEUE)
  const [reviewResults, setReviewResults] = useState<Record<string, ReviewFeedback>>({})
  const [reviewIndex, setReviewIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [known, setKnown] = useState(0)
  const [unknown, setUnknown] = useState(0)
  const [reviewNotice, setReviewNotice] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState<ReviewFeedback>('')
  const [reviewFeedbackMessage, setReviewFeedbackMessage] = useState('')
  const [toasts, setToasts] = useState<UiToast[]>([])
  const swipeStartXRef = useRef<number | null>(null)
  const reviewAdvanceTimeoutRef = useRef<number | null>(null)
  const toastTimeoutsRef = useRef<Record<string, number>>({})

  const pushToast = useCallback((message: string, tone: UiToastTone = 'info') => {
    const id = createToastId()
    const timeout = tone === 'warning' || tone === 'error' ? 4000 : 2500

    setToasts((current) => [...current, { id, tone, message }])

    toastTimeoutsRef.current[id] = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
      delete toastTimeoutsRef.current[id]
    }, timeout)
  }, [])

  const trackAppEvent = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    if (typeof window === 'undefined') {
      return
    }

    window.dataLayer = window.dataLayer ?? []
    window.dataLayer.push({
      event,
      source: 'app_shell',
      path,
      ts: new Date().toISOString(),
      ...payload,
    })
  }, [path])

  useEffect(() => {
    const onPop = () => setPath(getInitialPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    try {
      const sessionRaw = window.localStorage.getItem(SESSION_KEY)
      if (sessionRaw) {
        setUser(JSON.parse(sessionRaw) as User)
      }

      const contentRaw = window.localStorage.getItem(CONTENT_KEY)
      if (contentRaw) {
        const parsed = JSON.parse(contentRaw) as { chapterId?: string; sectionId?: string }
        const nextChapter =
          CHAPTERS.find((chapter) => chapter.id === parsed.chapterId) ?? CHAPTERS[0]
        const nextSection =
          nextChapter.sections.find((section) => section.id === parsed.sectionId) ?? nextChapter.sections[0]

        setChapterId(nextChapter.id)
        setSectionId(nextSection.id)
        setPickerChapterId(nextChapter.id)
        setPickerSectionId(nextSection.id)
      }

      const settingsRaw = window.localStorage.getItem(SETTINGS_KEY)
      if (settingsRaw) {
        const parsed = JSON.parse(settingsRaw) as { studyHour?: string; phrasesPerDay?: number }
        const nextStudyHour = parsed.studyHour ?? '20:00'
        const nextPhrasesPerDay = typeof parsed.phrasesPerDay === 'number' ? parsed.phrasesPerDay : 15

        setStudyHour(nextStudyHour)
        setStudyHourDraft(nextStudyHour)
        setPhrasesPerDay(nextPhrasesPerDay)
        setPhrasesPerDayDraft(nextPhrasesPerDay)
        pushToast('Estado restaurado', 'info')
      }
    } catch {
      pushToast('No pudimos restaurar tu sección anterior', 'error')
    } finally {
      window.setTimeout(() => {
        setAppHydrated(true)
      }, 160)
    }
  }, [pushToast])

  useEffect(() => {
    window.localStorage.setItem(CONTENT_KEY, JSON.stringify({ chapterId, sectionId }))
  }, [chapterId, sectionId])

  useEffect(() => {
    const toastTimeouts = toastTimeoutsRef.current

    return () => {
      if (reviewAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(reviewAdvanceTimeoutRef.current)
      }

      Object.values(toastTimeouts).forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
    }
  }, [])

  useEffect(() => {
    if (path === '/app/review/session') {
      return
    }

    swipeStartXRef.current = null
    setReviewFeedback('')
    setReviewNotice('')
    setReviewFeedbackMessage('')

    if (reviewAdvanceTimeoutRef.current !== null) {
      window.clearTimeout(reviewAdvanceTimeoutRef.current)
      reviewAdvanceTimeoutRef.current = null
    }
  }, [path])

  const go = (next: string) => {
    window.history.pushState({}, '', next)
    setPath(next)
  }

  const activeChapter = useMemo(
    () => CHAPTERS.find((item) => item.id === chapterId) ?? CHAPTERS[0],
    [chapterId],
  )
  const sectionOptions = useMemo(() => activeChapter.sections, [activeChapter])
  const activeSection = useMemo(
    () => sectionOptions.find((section) => section.id === sectionId) ?? sectionOptions[0] ?? null,
    [sectionId, sectionOptions],
  )
  const pickerChapter = useMemo(
    () => CHAPTERS.find((chapter) => chapter.id === pickerChapterId) ?? CHAPTERS[0],
    [pickerChapterId],
  )
  const pickerSectionOptions = useMemo(() => pickerChapter.sections, [pickerChapter])

  useEffect(() => {
    if (!activeSection && sectionOptions[0]) {
      setSectionId(sectionOptions[0].id)
    }
  }, [activeSection, sectionOptions])

  useEffect(() => {
    setPickerChapterId(chapterId)
    setPickerSectionId(sectionId)
  }, [chapterId, sectionId])

  useEffect(() => {
    if (studyHourDraft === studyHour && phrasesPerDayDraft === phrasesPerDay) {
      setSettingsSaveState((current) => (current === 'saved' ? current : 'idle'))
      return
    }

    setSettingsSaveState('dirty')
  }, [phrasesPerDay, phrasesPerDayDraft, studyHour, studyHourDraft])

  const ensureAuth = (target: string) => {
    if (!user) return go('/auth')
    if (target.startsWith('/admin') && user.role !== 'ADMIN') return go('/app/home')
    if (target.startsWith('/app') && user.role === 'ADMIN') return go('/admin/content')
    return go(target)
  }

  useEffect(() => {
    if (!user && path !== '/auth') {
      go('/auth')
    }

    if (user?.role === 'STANDARD' && path.startsWith('/admin')) {
      go('/app/home')
    }

    if (user?.role === 'ADMIN' && path.startsWith('/app')) {
      go('/admin/content')
    }
  }, [path, user])

  const sectionReady = Boolean(activeSection)
  const reviewProgress = reviewQueue.length === 0 ? 0 : Math.min(reviewIndex + 1, reviewQueue.length)
  const activeCard = reviewQueue[reviewIndex]
  const doneReview = reviewQueue.length > 0 && reviewIndex >= reviewQueue.length
  const failedReviewCards = reviewQueue.filter((card) => reviewResults[card.id] === 'unknown')
  const summaryItems = [
    { label: 'Días de racha', value: '6', tone: 'accent' },
    { label: 'Frases hoy', value: `${known + unknown}`, tone: 'neutral' },
    { label: 'Por repasar', value: `${REVIEW_QUEUE.length}`, tone: 'success' },
  ] as const
  const settingsDirty = studyHourDraft !== studyHour || phrasesPerDayDraft !== phrasesPerDay

  const resetReviewSession = (nextQueue = REVIEW_QUEUE) => {
    setReviewQueue(nextQueue)
    setReviewResults({})
    setReviewIndex(0)
    setShowAnswer(false)
    setKnown(0)
    setUnknown(0)
    setReviewNotice('')
    setReviewFeedback('')
    setReviewFeedbackMessage('')
  }

  const startReview = (queue = REVIEW_QUEUE, source: 'home' | 'repeat' = 'home') => {
    resetReviewSession(queue)
    if (source === 'home') {
      trackAppEvent('home_secondary_review_click', {
        queue_size: queue.length,
        chapter_id: chapterId,
        section_id: sectionId,
      })
    }
    ensureAuth('/app/review/session')
  }

  const handleAnswer = (isKnown: boolean) => {
    if (!showAnswer || reviewFeedback || doneReview || !activeCard) {
      return
    }

    const nextFeedback: ReviewFeedback = isKnown ? 'known' : 'unknown'

    setReviewFeedback(nextFeedback)
    setReviewFeedbackMessage(isKnown ? 'Marcada como conocida' : 'Volverá a repaso')
    setReviewResults((current) => ({
      ...current,
      [activeCard.id]: nextFeedback,
    }))

    if (isKnown) {
      setKnown((value) => value + 1)
    } else {
      setUnknown((value) => value + 1)
    }

    if (reviewAdvanceTimeoutRef.current !== null) {
      window.clearTimeout(reviewAdvanceTimeoutRef.current)
    }

    reviewAdvanceTimeoutRef.current = window.setTimeout(() => {
      setReviewIndex((index) => index + 1)
      setShowAnswer(false)
      setReviewNotice('')
      setReviewFeedback('')
      setReviewFeedbackMessage('')
      reviewAdvanceTimeoutRef.current = null
    }, 420)
  }

  const logout = () => {
    window.localStorage.removeItem(SESSION_KEY)
    setUser(null)
    go('/auth')
  }

  const handleAuthSubmit = () => {
    const nextErrors = {
      email: authForm.email.trim() ? '' : 'Ingresa un correo electrónico',
      password: authForm.password.trim() ? '' : 'Ingresa una contraseña',
    }

    setAuthFieldErrors(nextErrors)

    if (nextErrors.email || nextErrors.password) {
      return
    }

    const role: Role = authForm.email.includes('admin') ? 'ADMIN' : 'STANDARD'
    const nextUser = { email: authForm.email.trim(), role }
    setUser(nextUser)
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser))
    go(role === 'ADMIN' ? '/admin/content' : '/app/home')
  }

  const handleDemoAccess = () => {
    const nextUser = { email: 'demo@jaleco.app', role: 'STANDARD' as Role }
    setUser(nextUser)
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser))
    pushToast('Guardado correctamente', 'success')
    go('/app/home')
  }

  const applyPickerSection = (nextChapterId: string, nextSectionId: string) => {
    const nextChapter = CHAPTERS.find((chapter) => chapter.id === nextChapterId) ?? CHAPTERS[0]
    const nextSection =
      nextChapter.sections.find((section) => section.id === nextSectionId) ?? nextChapter.sections[0]

    setChapterId(nextChapter.id)
    setSectionId(nextSection.id)
    setPickerChapterId(nextChapter.id)
    setPickerSectionId(nextSection.id)
    setPickerOpen(false)
    pushToast('Sección actualizada', 'success')
    trackAppEvent('section_changed', {
      chapter_id: nextChapter.id,
      section_id: nextSection.id,
    })
  }

  const handleSettingsSave = () => {
    if (!settingsDirty) {
      pushToast('No hay cambios por guardar', 'warning')
      return
    }

    try {
      setSettingsSaveState('saving')
      window.localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ studyHour: studyHourDraft, phrasesPerDay: phrasesPerDayDraft }),
      )
      setStudyHour(studyHourDraft)
      setPhrasesPerDay(phrasesPerDayDraft)
      setSettingsSaveState('saved')
      pushToast('Configuración guardada', 'success')
      trackAppEvent('settings_saved', {
        study_hour: studyHourDraft,
        phrases_per_day: phrasesPerDayDraft,
      })
    } catch {
      setSettingsSaveState('error')
      pushToast('No se pudo completar la acción', 'error')
    }
  }

  const handleSettingsReset = () => {
    setStudyHourDraft(studyHour)
    setPhrasesPerDayDraft(phrasesPerDay)
    setSettingsSaveState('idle')
    pushToast('Estado restaurado', 'info')
  }

  const ToastStack = toasts.length > 0 && (
    <div className="app-toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`app-toast is-${toast.tone}`}>
          {toast.message}
        </div>
      ))}
    </div>
  )

  const AppNav = user && user.role === 'STANDARD' && (
    <nav className="bottom-nav" aria-label="Navegación principal">
      <button onClick={() => ensureAuth('/app/home')} className={path === '/app/home' ? 'active' : ''}>
        Inicio
      </button>
      <button onClick={() => ensureAuth('/app/stats')} className={path === '/app/stats' ? 'active' : ''}>
        Estadísticas
      </button>
      <button onClick={() => ensureAuth('/app/settings')} className={path === '/app/settings' ? 'active' : ''}>
        Ajustes
      </button>
    </nav>
  )

  if (path === '/auth') {
    return (
      <main className="app-shell">
        <section className="card auth-card auth-shell-card">
          <p className="eyebrow">Práctica guiada de frases</p>
          <h1>JALECO</h1>
          <p className="auth-brand-mark">by Jaleco Music</p>

          {!appHydrated ? (
            <div className="auth-skeleton">
              <div className="skeleton-block h-lg" />
              <div className="skeleton-block h-md" />
              <div className="skeleton-block h-md" />
            </div>
          ) : (
            <>
              <label>
                Correo electrónico
                <input
                  placeholder="tu@correo.com"
                  value={authForm.email}
                  onChange={(event) => {
                    setAuthForm((current) => ({ ...current, email: event.target.value, error: '' }))
                    setAuthFieldErrors((current) => ({ ...current, email: '' }))
                  }}
                />
                {authFieldErrors.email && <span className="inline-feedback is-error">{authFieldErrors.email}</span>}
              </label>

              <label>
                Contraseña
                <input
                  placeholder="Ingresa tu contraseña"
                  type="password"
                  value={authForm.password}
                  onChange={(event) => {
                    setAuthForm((current) => ({ ...current, password: event.target.value, error: '' }))
                    setAuthFieldErrors((current) => ({ ...current, password: '' }))
                  }}
                />
                {authFieldErrors.password && (
                  <span className="inline-feedback is-error">{authFieldErrors.password}</span>
                )}
              </label>

              {authForm.error && <p className="inline-feedback is-error">{authForm.error}</p>}

              <div className="row">
                <button onClick={handleAuthSubmit}>Entrar</button>
                <button className="ghost" onClick={handleDemoAccess}>
                  Crear acceso demo
                </button>
              </div>
            </>
          )}
        </section>
        {ToastStack}
      </main>
    )
  }

  if (!user) {
    return null
  }

  if (path === '/admin/content') {
    return (
      <main className="app-shell app-shell-admin">
        <section className="card admin-shell">
          <p className="eyebrow">Administración de contenido</p>
          <h2>JALECO</h2>
          <p>Gestiona capítulos y abre cada sección en el editor de preparación.</p>

          <div className="admin-section-list">
            {CHAPTERS.map((chapter) => (
              <article key={chapter.id} className="admin-chapter-card">
                <div>
                  <p className="eyebrow">Capítulo</p>
                  <h3>{chapter.title}</h3>
                </div>

                <div className="admin-section-rows">
                  {chapter.sections.map((section) => (
                    <div key={section.id} className="admin-section-row">
                      <div>
                        <strong>{section.title}</strong>
                        <span>Borrador listo para edición</span>
                      </div>
                      <button onClick={() => ensureAuth(`/admin/section/${section.id}/editor`)}>
                        Editar sección
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <button className="ghost" onClick={logout}>
            Cerrar sesión
          </button>
        </section>
        {ToastStack}
      </main>
    )
  }

  if (path.startsWith('/admin/section/')) {
    return (
      <>
        <StudyExperience
          allowEditing
          title="Editor de sección"
          subtitle="Admin · Editar texto y tiempos"
          initialViewMode="prep"
        />
        {ToastStack}
      </>
    )
  }

  if (path === '/app/study/setup') {
    return (
      <>
        <StudyExperience
          allowEditing={false}
          title="Preparación de estudio"
          subtitle="Usuario · Configura y comienza"
          initialViewMode="prep"
        />
        {AppNav}
        {ToastStack}
      </>
    )
  }

  if (path === '/app/study/live') {
    return (
      <>
        <StudyExperience
          allowEditing={false}
          title="Práctica en vivo"
          subtitle="Usuario · Teleprompter"
          initialViewMode="live"
        />
        {AppNav}
        {ToastStack}
      </>
    )
  }

  if (path === '/app/review/session') {
    return (
      <main className="app-shell with-nav">
        <section className="review-shell fade-enter">
          <header className="review-topbar card">
            <button className="ghost icon-button" onClick={() => ensureAuth('/app/home')} aria-label="Volver a inicio">
              ←
            </button>
            <div className="review-topbar-copy">
              <p className="eyebrow">Modo repaso</p>
              <strong>{activeSection?.title ?? 'Selecciona una sección'}</strong>
              <span>{activeChapter.title}</span>
            </div>
            <div className="review-progress-pill">
              {reviewQueue.length === 0 ? '0/0' : `${reviewProgress}/${reviewQueue.length}`}
            </div>
          </header>

          {!appHydrated ? (
            <section className="card review-card-panel">
              <div className="skeleton-block h-sm" />
              <div className="skeleton-block h-xl" />
              <div className="skeleton-block h-md" />
            </section>
          ) : null}

          {appHydrated && reviewQueue.length === 0 && (
            <section className="empty-state-card card">
              <p className="eyebrow">Sin cola de repaso</p>
              <h2>No hay frases para repasar ahora</h2>
              <p>Vuelve a Home y elige una sección para iniciar una nueva sesión.</p>
              <button onClick={() => ensureAuth('/app/home')}>Volver a Home</button>
            </section>
          )}

          {appHydrated && !doneReview && activeCard && (
            <>
              <article
                className={`review-card-panel card ${showAnswer ? 'is-revealed' : ''} ${reviewFeedback ? `is-${reviewFeedback}` : ''}`}
                onPointerDown={(event) => {
                  swipeStartXRef.current = event.clientX
                }}
                onPointerUp={(event) => {
                  if (!showAnswer || reviewFeedback || swipeStartXRef.current === null) return
                  const deltaX = event.clientX - swipeStartXRef.current
                  swipeStartXRef.current = null
                  if (deltaX >= 72) handleAnswer(true)
                  if (deltaX <= -72) handleAnswer(false)
                }}
                onPointerCancel={() => {
                  swipeStartXRef.current = null
                }}
              >
                <div className="review-card-aura" aria-hidden="true" />
                <div className="review-swipe-affordance is-left" aria-hidden="true">
                  No
                </div>
                <div className="review-swipe-affordance is-right" aria-hidden="true">
                  Sí
                </div>
                <p className="eyebrow">{showAnswer ? 'Respuesta revelada' : 'Escucha y recuerda'}</p>
                <h2 className="review-prompt">{activeCard.en}</h2>

                <button
                  className="ghost review-audio-button"
                  onClick={() => {
                    if (activeCard.start !== undefined && activeCard.end !== undefined) {
                      setReviewNotice(`Segmento listo: ${activeCard.start}s - ${activeCard.end}s`)
                      return
                    }

                    setReviewNotice('Sin timestamps. Usa audio completo como fallback.')
                  }}
                >
                  {activeCard.start !== undefined && activeCard.end !== undefined
                    ? 'Reproducir segmento'
                    : 'Audio fallback'}
                </button>

                {!showAnswer ? (
                  <>
                    <button className="review-reveal-button" onClick={() => setShowAnswer(true)}>
                      Mostrar respuesta
                    </button>
                    <p className="review-gesture-hint">Primero muestra la respuesta y luego responde</p>
                  </>
                ) : (
                  <div className="review-answer-panel">
                    <p>{activeCard.es || 'Sin traducción disponible.'}</p>
                    <span>¿La recordaste?</span>
                  </div>
                )}

                {reviewFeedback && (
                  <div className={`review-feedback-flash is-${reviewFeedback}`} aria-hidden="true">
                    <span>{reviewFeedback === 'known' ? 'Sí' : 'No'}</span>
                  </div>
                )}
              </article>

              {(reviewNotice || reviewFeedbackMessage) && (
                <p className="review-notice" aria-live="polite">
                  {reviewFeedbackMessage || reviewNotice}
                </p>
              )}

              {showAnswer ? (
                <div className="review-actions review-actions-sticky">
                  <button className="review-answer-button is-no" onClick={() => handleAnswer(false)}>
                    No la recordé
                  </button>
                  <button className="review-answer-button is-yes" onClick={() => handleAnswer(true)}>
                    Sí la recordé
                  </button>
                </div>
              ) : null}
            </>
          )}

          {appHydrated && doneReview && (
            <section className="review-summary-preview card">
              <p className="eyebrow">Sesión completada</p>
              <h2>Resumen del repaso</h2>
              <p className="summary-lead">Cerraste una sesión corta con feedback inmediato y ritmo sostenido.</p>
              <div className="summary-grid">
                <article className="summary-stat-card">
                  <span>Frases vistas</span>
                  <strong>{reviewQueue.length}</strong>
                </article>
                <article className="summary-stat-card">
                  <span>Conocidas</span>
                  <strong>{known}</strong>
                </article>
                <article className="summary-stat-card">
                  <span>Falladas</span>
                  <strong>{unknown}</strong>
                </article>
                <article className="summary-stat-card">
                  <span>Racha</span>
                  <strong>6 días</strong>
                </article>
              </div>

              <div className="summary-actions">
                {failedReviewCards.length > 0 && (
                  <button
                    onClick={() => {
                      trackAppEvent('review_repeat_failed_click', { failed_count: failedReviewCards.length })
                      startReview(failedReviewCards, 'repeat')
                    }}
                  >
                    Repasar falladas
                  </button>
                )}
                <button className="ghost" onClick={() => ensureAuth('/app/home')}>
                  Volver a Home
                </button>
                <button className="ghost" onClick={() => ensureAuth('/app/study/setup')}>
                  Ir a práctica guiada
                </button>
              </div>
            </section>
          )}
        </section>
        {AppNav}
        {ToastStack}
      </main>
    )
  }

  if (path === '/app/review/summary') {
    return (
      <main className="app-shell with-nav">
        <section className="card summary-shell fade-enter">
          <p className="eyebrow">Resumen del repaso</p>
          <h2>Sesión cerrada</h2>
          <p className="summary-lead">Sigue con otra tanda corta o vuelve a tu práctica guiada.</p>
          <div className="summary-grid">
            <article className="summary-stat-card">
              <span>Frases vistas</span>
              <strong>{reviewQueue.length}</strong>
            </article>
            <article className="summary-stat-card">
              <span>Conocidas</span>
              <strong>{known}</strong>
            </article>
            <article className="summary-stat-card">
              <span>Falladas</span>
              <strong>{unknown}</strong>
            </article>
            <article className="summary-stat-card">
              <span>Racha</span>
              <strong>6 días</strong>
            </article>
          </div>
          <div className="summary-actions">
            {failedReviewCards.length > 0 && (
              <button
                onClick={() => {
                  trackAppEvent('review_repeat_failed_click', { failed_count: failedReviewCards.length })
                  startReview(failedReviewCards, 'repeat')
                }}
              >
                Repasar falladas
              </button>
            )}
            <button className="ghost" onClick={() => ensureAuth('/app/home')}>
              Volver a Home
            </button>
            <button className="ghost" onClick={() => ensureAuth('/app/study/setup')}>
              Ir a práctica guiada
            </button>
          </div>
        </section>
        {AppNav}
        {ToastStack}
      </main>
    )
  }

  if (path === '/app/stats') {
    return (
      <main className="app-shell with-nav">
        <section className="card stats-shell fade-enter">
          <p className="eyebrow">Tu progreso</p>
          <h2>Estadísticas</h2>

          {known + unknown === 0 ? (
            <section className="empty-state-card">
              <h3>Tus métricas aparecerán cuando completes sesiones.</h3>
              <p>Empieza una práctica guiada o un repaso corto para llenar este espacio con actividad real.</p>
            </section>
          ) : (
            <div className="summary-grid">
              <article className="summary-stat-card">
                <span>Sesiones</span>
                <strong>1</strong>
              </article>
              <article className="summary-stat-card">
                <span>Conocidas</span>
                <strong>{known}</strong>
              </article>
              <article className="summary-stat-card">
                <span>Falladas</span>
                <strong>{unknown}</strong>
              </article>
              <article className="summary-stat-card">
                <span>Racha</span>
                <strong>6 días</strong>
              </article>
            </div>
          )}
        </section>
        {AppNav}
        {ToastStack}
      </main>
    )
  }

  if (path === '/app/settings') {
    return (
      <main className="app-shell with-nav">
        <section className="card settings-shell fade-enter">
          <p className="eyebrow">Preferencias personales</p>
          <h2>Ajustes</h2>

          {!appHydrated ? (
            <>
              <div className="skeleton-block h-md" />
              <div className="skeleton-block h-md" />
            </>
          ) : (
            <>
              <label>
                Hora de estudio
                <input
                  type="time"
                  value={studyHourDraft}
                  onChange={(event) => setStudyHourDraft(event.target.value)}
                />
              </label>
              <label>
                Frases por día
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={phrasesPerDayDraft}
                  onChange={(event) => setPhrasesPerDayDraft(Number(event.target.value))}
                />
              </label>

              {settingsSaveState === 'saved' && (
                <p className="inline-feedback is-success">Configuración guardada</p>
              )}

              <div className="row">
                <button onClick={handleSettingsSave} disabled={!settingsDirty}>
                  Guardar cambios
                </button>
                <button className="ghost" onClick={handleSettingsReset} disabled={!settingsDirty}>
                  Restablecer
                </button>
              </div>
            </>
          )}

          <button className="ghost" onClick={logout}>
            Cerrar sesión
          </button>
        </section>
        {AppNav}
        {ToastStack}
      </main>
    )
  }

  return (
    <main className="app-shell with-nav">
      <section className="home-shell fade-enter">
        {!appHydrated ? (
          <>
            <section className="card home-hero">
              <div className="skeleton-block h-sm" />
              <div className="skeleton-block h-xl" />
              <div className="skeleton-block h-md" />
            </section>
            <section className="card">
              <div className="skeleton-block h-md" />
              <div className="skeleton-block h-md" />
            </section>
            <section className="card">
              <div className="skeleton-block h-lg" />
            </section>
          </>
        ) : (
          <>
            <header className="home-hero card">
              <p className="eyebrow">Tu práctica de hoy</p>
              <h1>JALECO</h1>
              <p className="home-hero-copy">
                {sectionReady
                  ? 'Continúa con tu sección actual o haz un repaso rápido.'
                  : 'Elige una sección para empezar tu práctica.'}
              </p>
            </header>

            <section className={`home-selection-card card ${pickerOpen ? 'is-open' : ''}`}>
              <div className="home-selection-copy">
                <span className="home-selection-icon" aria-hidden="true">
                  ◌
                </span>
                <div>
                  <p className="eyebrow">Sección activa</p>
                  <h2>{activeChapter.title}</h2>
                  <p>{activeSection?.title ?? 'Todavía no hay una sección seleccionada'}</p>
                </div>
              </div>

              <button
                className="ghost"
                onClick={() => {
                  setPickerOpen((current) => !current)
                  setPickerChapterId(chapterId)
                  setPickerSectionId(sectionId)
                }}
                aria-expanded={pickerOpen}
                aria-controls="home-section-picker"
              >
                {pickerOpen ? 'Ocultar' : 'Cambiar sección'}
              </button>

              {pickerOpen && (
                <div id="home-section-picker" className="home-picker-card">
                  <label>
                    Capítulo
                    <select
                      value={pickerChapterId}
                      onChange={(event) => {
                        const nextChapterId = event.target.value
                        const nextChapter = CHAPTERS.find((chapter) => chapter.id === nextChapterId) ?? CHAPTERS[0]
                        setPickerChapterId(nextChapterId)
                        setPickerSectionId(nextChapter.sections[0]?.id ?? '')
                      }}
                    >
                      {CHAPTERS.map((chapter) => (
                        <option key={chapter.id} value={chapter.id}>
                          {chapter.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Sección
                    <select
                      value={pickerSectionId}
                      onChange={(event) => {
                        const nextSectionId = event.target.value
                        setPickerSectionId(nextSectionId)
                        applyPickerSection(pickerChapter.id, nextSectionId)
                      }}
                    >
                      {pickerSectionOptions.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </section>

            <section className="card home-primary-action-card">
              <div>
                <p className="eyebrow">Recomendado</p>
                <h2>{sectionReady ? 'Continúa con tu práctica guiada' : 'Elige una sección para empezar'}</h2>
                <p>
                  {sectionReady
                    ? 'Entra directo al setup de tu sección actual y ajusta la sesión en segundos.'
                    : 'Selecciona una sección para habilitar la práctica guiada y el repaso rápido.'}
                </p>
              </div>
              <button
                className="home-primary-cta"
                onClick={() => {
                  trackAppEvent('home_primary_cta_click', {
                    chapter_id: chapterId,
                    section_id: sectionId,
                    section_ready: sectionReady,
                  })

                  if (!sectionReady) {
                    setPickerOpen(true)
                    return
                  }

                  ensureAuth('/app/study/setup')
                }}
              >
                {sectionReady ? 'Continuar práctica' : 'Elegir sección'}
              </button>
            </section>

            <section className="card home-secondary-action-card">
              <div>
                <p className="eyebrow">Repaso rápido</p>
                <h2>{`Repasar ${REVIEW_QUEUE.length} frases`}</h2>
                <p>Haz una sesión corta por tarjetas con respuesta rápida y feedback inmediato.</p>
              </div>
              <button className="ghost" disabled={!sectionReady} onClick={() => startReview()}>
                {`Repasar ${REVIEW_QUEUE.length} frases`}
              </button>
            </section>

            <section className="home-mode-grid home-mode-grid-secondary">
              <article className="home-mode-card card">
                <p className="eyebrow">Modo estudio</p>
                <h2>Teleprompter</h2>
                <p>Textos completos, foco visual, ritmo y control en vivo.</p>
                <button className="ghost" disabled={!sectionReady} onClick={() => ensureAuth('/app/study/setup')}>
                  Abrir setup
                </button>
              </article>

              <article className="home-mode-card card review">
                <p className="eyebrow">Modo repaso</p>
                <h2>Flash cards</h2>
                <p>Reveal, swipe y decisiones rápidas para reforzar frases clave.</p>
                <button className="ghost" disabled={!sectionReady} onClick={() => startReview()}>
                  Abrir repaso
                </button>
              </article>
            </section>

            <section className="card home-summary-card">
              <div className="home-summary-head">
                <div>
                  <p className="eyebrow">Resumen del día</p>
                  <h2>Actividad</h2>
                </div>
                <span className="summary-badge">{sectionReady ? 'En ritmo' : 'Pendiente'}</span>
              </div>

              <div className="home-summary-grid">
                {summaryItems.map((item) => (
                  <article key={item.label} className={`summary-stat-card is-${item.tone}`}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>

              <div className="summary-progress" aria-hidden="true">
                <span style={{ width: sectionReady ? '68%' : '24%' }} />
              </div>
            </section>
          </>
        )}
      </section>
      {AppNav}
      {ToastStack}
    </main>
  )
}

export default App

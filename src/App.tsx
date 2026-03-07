import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useProgressStore } from '@/stores/useProgressStore'

const HomePage = lazy(() => import('@/pages/HomePage'))
const CoursePage = lazy(() => import('@/pages/CoursePage'))
const LessonPrepPage = lazy(() => import('@/pages/LessonPrepPage'))
const LessonLivePage = lazy(() => import('@/pages/LessonLivePage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

function LoadingScreen() {
  return (
    <div className="app-shell flex items-center justify-center min-h-dvh">
      <div className="text-[var(--text-muted)] text-lg font-medium">Cargando...</div>
    </div>
  )
}

export default function App() {
  const darkMode = useSettingsStore((s) => s.darkMode)
  const loadAllProgress = useProgressStore((s) => s.loadAllProgress)

  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', !darkMode)
  }, [darkMode])

  useEffect(() => {
    loadAllProgress()
  }, [loadAllProgress])

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/course/:courseId" element={<CoursePage />} />
          <Route path="/course/:courseId/lesson/:lessonId/prep" element={<LessonPrepPage />} />
          <Route path="/course/:courseId/lesson/:lessonId/live" element={<LessonLivePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

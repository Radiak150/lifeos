import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useParams, useLocation } from 'react-router-dom'
import { LifeOSProvider, useLifeOS } from './app/LifeOSProvider'
import SharingBridge from './components/SharingBridge'
import Layout from './components/Layout'
import { applyTheme } from './lib/theme'
const AreasPage = lazy(() => import('./pages/AreasPage'))
import AppErrorBoundary from './components/AppErrorBoundary'
import { Button, EmptyState, LoadingScreen } from './components/ui'

const SharedViewerPage = lazy(() => import('./pages/SharedViewerPage'))
const SharingPage = lazy(() => import('./pages/SharingPage'))
const WelcomePage = lazy(() => import('./pages/WelcomePage'))
const GuidePage = lazy(() => import('./pages/GuidePage'))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'))
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'))

function CustomAreaRoute() {
  const { categoryId } = useParams()
  const { settings } = useLifeOS()
  const category = settings.customCategories?.find(c => c.id === categoryId)
  return category ? <ModulePage key={category.id} module={category.id} /> : <Navigate to="/categories" replace />
}

const Dashboard = lazy(() => import('./pages/Dashboard'))
const HabitsPage = lazy(() => import('./pages/HabitsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SleepPage = lazy(() => import('./pages/SleepPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const TodayPage = lazy(() => import('./pages/TodayPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const TherapyPage = lazy(() => import('./pages/TherapyPage'))
const ModulePage = lazy(() => import('./pages/ModulePage'))

function AppRoutes() {
  const { ready, error, settings } = useLifeOS()

  useEffect(() => {
    const root = document.documentElement
    applyTheme(settings.appearance?.theme ?? 'light')
    root.style.setProperty('--font-scale', String(settings.appearance?.fontScale ?? 1))
    root.dataset.density = settings.appearance?.density ?? 'comfortable'
    root.dataset.contrast = settings.appearance?.highContrast ? 'high' : 'normal'
    root.dataset.reduceMotion = settings.appearance?.reduceMotion ? 'true' : 'false'
    root.dataset.focusMode = settings.appearance?.focusMode ? 'true' : 'false'
  }, [settings.appearance])

  if (error) {
    return <div className="fatal-state"><EmptyState icon="error" title="Não foi possível abrir o LifeOS" description={error} action={<Button onClick={() => window.location.reload()}>Tentar novamente</Button>} /></div>
  }
  if (!ready) return <LoadingScreen />
  if (settings.onboarding?.completed === false) return <Suspense fallback={<LoadingScreen />}><WelcomePage /></Suspense>

  return (
    <Suspense fallback={<LoadingScreen />}>
      <SharingBridge />
      <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="sharing" element={<SharingPage />} />
        <Route path="guide" element={<GuidePage />} />
        <Route path="areas" element={<AreasPage />} />
        <Route path="projects" element={<ModulePage key="fushi" module="fushi" />} />
        <Route path="pets" element={<ModulePage key="pets" module="pets" />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="achievements" element={<AchievementsPage />} />
        <Route path="area/:categoryId" element={<CustomAreaRoute />} />
        <Route path="today" element={<TodayPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="therapy" element={<TherapyPage />} />
        <Route path="fushi" element={<ModulePage key="fushi" module="fushi" />} />
        <Route path="college" element={<ModulePage key="college" module="college" />} />
        <Route path="fitness" element={<ModulePage key="fitness" module="fitness" />} />
        <Route path="relationship" element={<ModulePage key="relationship" module="relationship" />} />
        <Route path="home" element={<ModulePage key="home" module="home" />} />
        <Route path="work" element={<ModulePage key="work" module="work" />} />
        <Route path="habits" element={<HabitsPage />} />
        <Route path="sleep" element={<SleepPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  const location=useLocation()
  if(location.pathname.startsWith('/shared/')) return <AppErrorBoundary><Suspense fallback={<LoadingScreen />}><Routes><Route path="/shared/:shareId" element={<SharedViewerPage />} /></Routes></Suspense></AppErrorBoundary>
  return <AppErrorBoundary><LifeOSProvider><AppRoutes /></LifeOSProvider></AppErrorBoundary>
}

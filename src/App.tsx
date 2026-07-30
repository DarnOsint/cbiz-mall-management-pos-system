import { useEffect, lazy, Suspense } from 'react'
import { useNotifications } from './hooks/useNotifications'
import { ToastProvider } from './context/ToastContext'
import AppShell from './components/AppShell'
import NotificationToast from './components/NotificationToast'
import ErrorBoundary from './components/ErrorBoundary'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/auth/Login'

const POS = lazy(() => import('./pages/pos/POS'))
const Management = lazy(() => import('./pages/management/Management'))
const Executive = lazy(() => import('./pages/executive/Executive'))
const Accounting = lazy(() => import('./pages/accounting/Accounting'))
const Debtors = lazy(() => import('./pages/accounting/Debtors'))
const Reports = lazy(() => import('./pages/reports/Reports'))
const BackOffice = lazy(() => import('./pages/backoffice/BackOffice'))
const MonthEnd = lazy(() => import('./pages/monthend/MonthEnd'))
const MallManagement = lazy(() => import('./pages/backoffice/MallManagement'))
import type { Role } from './types'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    const main = document.getElementById('main-scroll')
    if (main) {
      main.scrollTop = 0
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [pathname])
  return null
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  if (loading || (user && !profile))
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md px-4">
          <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-800 rounded animate-pulse w-1/2" />
          <div className="h-10 bg-gray-800 rounded animate-pulse w-full" />
          <div className="h-10 bg-gray-800 rounded animate-pulse w-full" />
          <div className="h-4 bg-gray-800 rounded animate-pulse w-2/3" />
        </div>
      </div>
    )
  if (!user) return <Navigate to="/login" />
  return <>{children}</>
}

function RoleGuard({ children, allowed }: { children: React.ReactNode; allowed: Role[] }) {
  const { user, profile, loading } = useAuth()
  if (loading || (user && !profile))
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md px-4">
          <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-800 rounded animate-pulse w-1/2" />
          <div className="h-10 bg-gray-800 rounded animate-pulse w-full" />
          <div className="h-10 bg-gray-800 rounded animate-pulse w-full" />
          <div className="h-4 bg-gray-800 rounded animate-pulse w-2/3" />
        </div>
      </div>
    )
  if (!profile) return <Navigate to="/login" />
  if (!allowed.includes(profile.role as Role)) return <Navigate to="/dashboard" />
  return <>{children}</>
}

function RoleRoute() {
  const { user, profile, loading } = useAuth()
  if (loading || (user && !profile))
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md px-4">
          <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-800 rounded animate-pulse w-1/2" />
          <div className="h-10 bg-gray-800 rounded animate-pulse w-full" />
          <div className="h-10 bg-gray-800 rounded animate-pulse w-full" />
          <div className="h-4 bg-gray-800 rounded animate-pulse w-2/3" />
        </div>
      </div>
    )
  if (!profile) return <Navigate to="/login" />
  if (profile.role === 'owner') return <Navigate to="/executive" />
  if (profile.role === 'manager') return <Navigate to="/management" />
  if (profile.role === 'staff') return <Navigate to="/pos" />
  return <Navigate to="/login" />
}

const EB = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <ErrorBoundary title={title}>{children}</ErrorBoundary>
)

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <RoleRoute />
              </PrivateRoute>
            }
          />
          <Route
            path="/executive"
            element={
              <PrivateRoute>
                <RoleGuard allowed={['owner']}>
                  <EB title="Dashboard error">
                    <Executive />
                  </EB>
                </RoleGuard>
              </PrivateRoute>
            }
          />
          <Route
            path="/management"
            element={
              <PrivateRoute>
                <RoleGuard allowed={['owner', 'manager']}>
                  <EB title="Management error">
                    <Management />
                  </EB>
                </RoleGuard>
              </PrivateRoute>
            }
          />
          <Route
            path="/accounting"
            element={
              <PrivateRoute>
                <RoleGuard allowed={['owner', 'manager']}>
                  <EB title="Accounting error">
                    <Accounting />
                  </EB>
                </RoleGuard>
              </PrivateRoute>
            }
          />
          <Route
            path="/backoffice"
            element={
              <PrivateRoute>
                <RoleGuard allowed={['owner', 'manager']}>
                  <EB title="Back office error">
                    <BackOffice />
                  </EB>
                </RoleGuard>
              </PrivateRoute>
            }
          />
          <Route
            path="/pos"
            element={
              <PrivateRoute>
                <RoleGuard allowed={['owner', 'manager', 'staff']}>
                  <EB title="POS error">
                    <POS />
                  </EB>
                </RoleGuard>
              </PrivateRoute>
            }
          />
          <Route
            path="/debtors"
            element={
              <PrivateRoute>
                <RoleGuard allowed={['owner', 'manager']}>
                  <EB title="Debtors error">
                    <Debtors onBack={() => window.history.back()} />
                  </EB>
                </RoleGuard>
              </PrivateRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <PrivateRoute>
                <RoleGuard allowed={['owner', 'manager']}>
                  <EB title="Reports error">
                    <Reports />
                  </EB>
                </RoleGuard>
              </PrivateRoute>
            }
          />
          <Route
            path="/month-end"
            element={
              <PrivateRoute>
                <RoleGuard allowed={['owner', 'manager']}>
                  <EB title="Month End error">
                    <MonthEnd />
                  </EB>
                </RoleGuard>
              </PrivateRoute>
            }
          />
          <Route
            path="/mallmanagement"
            element={
              <PrivateRoute>
                <RoleGuard allowed={['owner', 'manager']}>
                  <EB title="Mall Management error">
                    <MallManagement />
                  </EB>
                </RoleGuard>
              </PrivateRoute>
            }
          />
          <Route path="/mall" element={<Navigate to="/mallmanagement" replace />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Suspense>
    </>
  )
}

function AppInner() {
  const { profile } = useAuth()
  const { toasts, dismiss } = useNotifications(profile)
  const location = useLocation()

  if (location.pathname === '/customer-display') {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <Routes>
          <Route path="/customer-display" element={<CustomerDisplay />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <ToastProvider>
      <NotificationToast toasts={toasts} onDismiss={dismiss} />
      <AppShell>
        <AppRoutes />
      </AppShell>
    </ToastProvider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

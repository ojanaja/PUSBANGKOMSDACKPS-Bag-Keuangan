import { lazy, Suspense, useEffect } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/shared/api/queryClient'
import { configureApiErrorHandlers } from '@/shared/api/httpClient'
import { useAuthStore } from '@/stores/authStore'
import { ToastProvider } from '@/shared/providers/ToastProvider'
import { useToast } from '@/shared/hooks/useToast'
import AppLayout from './components/layout/AppLayout'
import AppLoader from '@/shared/ui/AppLoader'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AnggaranPage = lazy(() => import('./pages/AnggaranPage'))
const PaketListPage = lazy(() => import('./pages/PaketListPage'))
const PaketWizardPage = lazy(() => import('./pages/PaketWizardPage'))
const ProgresPage = lazy(() => import('./pages/ProgresPage'))
const KurvaSPage = lazy(() => import('./pages/KurvaSPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const EWSPage = lazy(() => import('./pages/EWSPage'))
const AuditTrailPage = lazy(() => import('./pages/AuditTrailPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function PageLoader() {
  return <AppLoader label="Memuat halaman..." />
}

function FullScreenLoader() {
  return <AppLoader fullscreen label="Menyiapkan aplikasi..." />
}

function ProtectedRoute() {
  const { isAuthenticated, isInitialized } = useAuthStore()

  if (!isInitialized) return <FullScreenLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <Outlet />
}

function PublicRoute() {
  const { isAuthenticated, isInitialized } = useAuthStore()

  if (!isInitialized) return <FullScreenLoader />
  if (isAuthenticated) return <Navigate to="/" replace />

  return <Outlet />
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <PublicRoute />,
    children: [
      { index: true, element: <Suspense fallback={<FullScreenLoader />}><LoginPage /></Suspense> },
    ],
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Suspense fallback={<PageLoader />}><DashboardPage /></Suspense> },
          { path: 'anggaran', element: <Suspense fallback={<PageLoader />}><AnggaranPage /></Suspense> },
          { path: 'progres-satker', element: <Suspense fallback={<PageLoader />}><PaketListPage /></Suspense> },
          { path: 'progres-satker/tambah', element: <Suspense fallback={<PageLoader />}><PaketWizardPage /></Suspense> },
          { path: 'progres/:id', element: <Suspense fallback={<PageLoader />}><ProgresPage /></Suspense> },
          { path: 'kurva-s/:id', element: <Suspense fallback={<PageLoader />}><KurvaSPage /></Suspense> },
          { path: 'paket', element: <Navigate to="/progres-satker" replace /> },
          { path: 'paket/tambah', element: <Navigate to="/progres-satker/tambah" replace /> },
          { path: 'progres', element: <Navigate to="/progres-satker" replace /> },
          { path: 'kurva-s', element: <Navigate to="/progres-satker" replace /> },
          { path: 'users', element: <Suspense fallback={<PageLoader />}><UsersPage /></Suspense> },
          { path: 'ews', element: <Suspense fallback={<PageLoader />}><EWSPage /></Suspense> },
          { path: 'audit-trail', element: <Suspense fallback={<PageLoader />}><AuditTrailPage /></Suspense> },
          { path: '*', element: <Suspense fallback={<PageLoader />}><NotFoundPage /></Suspense> },
        ],
      },
    ],
  },
])

export default function App() {
  const { checkAuth, isInitialized } = useAuthStore()
  const { showToast } = useToast()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    configureApiErrorHandlers({
      onUnauthorized: async () => {
        const { logout } = useAuthStore.getState()
        await logout()
        if (window.location.pathname !== '/login') {
          window.location.assign('/login')
        }
      },
      onServerError: (message) => {
        showToast(message, 'error')
      },
    })

    return () => {
      configureApiErrorHandlers({})
    }
  }, [showToast])

  if (!isInitialized) {
    return <FullScreenLoader />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

export function AppWithProviders() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  )
}

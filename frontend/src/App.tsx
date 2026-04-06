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
const AnggaranPage = lazy(() => import('./pages/AnggaranPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
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
          { index: true, element: <Navigate to="/anggaran" replace /> },
          { path: 'anggaran', element: <Suspense fallback={<PageLoader />}><AnggaranPage /></Suspense> },
          { path: 'users', element: <Suspense fallback={<PageLoader />}><UsersPage /></Suspense> },
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

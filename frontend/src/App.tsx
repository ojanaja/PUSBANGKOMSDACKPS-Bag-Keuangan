import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'

// Lazy load pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AnggaranPage = lazy(() => import('./pages/AnggaranPage'))
const PaketPage = lazy(() => import('./pages/PaketPage'))
const ProgresPage = lazy(() => import('./pages/ProgresPage'))
const KurvaSPage = lazy(() => import('./pages/KurvaSPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Suspense fallback={<PageLoader />}><DashboardPage /></Suspense> },
      { path: 'anggaran', element: <Suspense fallback={<PageLoader />}><AnggaranPage /></Suspense> },
      { path: 'paket', element: <Suspense fallback={<PageLoader />}><PaketPage /></Suspense> },
      { path: 'progres', element: <Suspense fallback={<PageLoader />}><ProgresPage /></Suspense> },
      { path: 'kurva-s', element: <Suspense fallback={<PageLoader />}><KurvaSPage /></Suspense> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}

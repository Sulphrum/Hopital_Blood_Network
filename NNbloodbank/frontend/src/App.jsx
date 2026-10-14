import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { useAuth, AuthProvider } from '@/hooks'

import LoginPage from '@/pages/LoginPage'
import SignUpPage from '@/pages/SignUpPage'

const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const InventoryPage = lazy(() => import('@/pages/InventoryPage'))
const ForecastPage = lazy(() => import('@/pages/ForecastPage'))
const TransfersPage = lazy(() => import('@/pages/TransfersPage'))
const NetworkPage = lazy(() => import('@/pages/NetworkPage'))
const AlertsPage = lazy(() => import('@/pages/AlertsPage'))
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/app">
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <SignUpPage />
              </PublicRoute>
            }
          />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/transfers" element={<TransfersPage />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

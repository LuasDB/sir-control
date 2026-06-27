import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, NotificationsProvider, SocketProvider, useAuth } from './context/AppContext'
import AppLayout from './components/layout/AppLayout'
import { LoginPage, ForgotPasswordPage, ResetPasswordPage } from './pages/auth/AuthPages'
import DashboardPage from './pages/dashboard/DashboardPage'
import { ProjectsPage, ProjectDetailPage } from './pages/projects/ProjectsPages'
import { ActivitiesPage, ActivityDetailPage } from './pages/activities/ActivitiesPages'
import { UsersPage, DepartmentsPage, NotificationsPage, AccountSettingsPage } from './pages/misc/MiscPages'
import HelpPage from './pages/help/HelpPage'
import CalendarPage, { WelcomePrompt } from './pages/calendar/CalendarPage'
import ReportsPage from './pages/reports/ReportsPage'
import { Spinner } from './components/ui'

// ── Guards ────────────────────────────────────────────────────────────────────
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
      <Spinner size="xl" />
    </div>
  )
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children
}

// ── Prompt de bienvenida global (montado dentro de AppLayout) ─────────────────
const GlobalWelcomePrompt = () => {
  const { showWelcomePrompt, dismissWelcomePrompt } = useAuth()
  const navigate = useNavigate()

  if (!showWelcomePrompt) return null

  return (
    <WelcomePrompt
      onDismiss={dismissWelcomePrompt}
      onGoCalendar={() => {
        dismissWelcomePrompt()
        navigate('/calendar')
      }}
    />
  )
}

// ── Inner App ─────────────────────────────────────────────────────────────────
const InnerApp = () => (
  <>
    <Routes>
      {/* Públicas */}
      <Route path="/login"           element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password"  element={<ResetPasswordPage />} />

      {/* Protegidas */}
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index                      element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"           element={<DashboardPage />} />
        <Route path="projects"            element={<ProjectsPage />} />
        <Route path="projects/:id"        element={<ProjectDetailPage />} />
        <Route path="activities"          element={<ActivitiesPage />} />
        <Route path="activities/:id"      element={<ActivityDetailPage />} />
        <Route path="calendar"            element={<CalendarPage />} />
        <Route path="reports"             element={<ReportsPage />} />
        <Route path="users"               element={<UsersPage />} />
        <Route path="departments"         element={<DepartmentsPage />} />
        <Route path="notifications"      element={<NotificationsPage />} />
        <Route path="settings"           element={<AccountSettingsPage />} />
        <Route path="help"               element={<HelpPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>

    {/* Prompt de bienvenida — se renderiza encima de todo al hacer login */}
    <PrivateRoute>
      <GlobalWelcomePrompt />
    </PrivateRoute>
  </>
)

// ── Root ──────────────────────────────────────────────────────────────────────
const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <NotificationsProvider>
        <SocketProvider>
          <InnerApp />
          <Toaster
            position="top-right"
            toastOptions={{
              duration : 3500,
              style    : {
                fontSize    : '13px',
                fontFamily  : 'Inter, sans-serif',
                borderRadius: '10px',
                border      : '1px solid rgba(0,0,0,0.08)',
                boxShadow   : '0 4px 16px rgba(0,0,0,0.12)',
                color       : '#1D1C19',
                background  : '#FFFFFF',
              },
              success: { iconTheme: { primary:'#2BA84A', secondary:'#fff' } },
              error  : { iconTheme: { primary:'#E63946', secondary:'#fff' } },
              loading: { iconTheme: { primary:'#F8CD24', secondary:'#1D1C19' } },
            }}
          />
        </SocketProvider>
      </NotificationsProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App

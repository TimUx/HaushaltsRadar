import { useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './layouts/AppLayout'
import { createAppTheme } from './theme'
import { DashboardPage } from './pages/DashboardPage'
import { StructurePage } from './pages/StructurePage'
import { CostsOverviewPage } from './pages/CostsOverviewPage'
import { HistoryPage } from './pages/HistoryPage'
import { LoginPage } from './pages/LoginPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { ProfilePage } from './pages/ProfilePage'
import { PersonsPage } from './pages/PersonsPage'
import { PartiesPage } from './pages/PartiesPage'
import { ObjectsPage } from './pages/ObjectsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { TagsPage } from './pages/TagsPage'
import { CostItemsPage } from './pages/CostItemsPage'
import { ContractsPage } from './pages/ContractsPage'
import { UsersPage } from './pages/UsersPage'
import { AdminDataPage } from './pages/AdminDataPage'
import { AdminSmtpPage } from './pages/AdminSmtpPage'
import { AnalysesPage } from './pages/AnalysesPage'
import { ReportsPage } from './pages/ReportsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function ThemedApp() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('kp_theme')
    return stored === 'dark' ? 'dark' : 'light'
  })
  const theme = useMemo(() => createAppTheme(mode), [mode])

  function toggleMode() {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem('kp_theme', next)
      return next
    })
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout mode={mode} onToggleMode={toggleMode} />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="passwort-vergessen" element={<ForgotPasswordPage />} />
              <Route path="passwort-zuruecksetzen" element={<ResetPasswordPage />} />
              <Route element={<ProtectedRoute roles={['admin', 'user', 'viewer']} />}>
                <Route index element={<DashboardPage />} />
                <Route path="analysen" element={<AnalysesPage />} />
                <Route path="berichte" element={<ReportsPage />} />
                <Route path="struktur" element={<StructurePage />} />
                <Route path="kostenuebersicht" element={<CostsOverviewPage />} />
                <Route path="historie" element={<HistoryPage />} />
                <Route path="konto" element={<ProfilePage />} />
              </Route>
              <Route element={<ProtectedRoute roles={['admin', 'user']} />}>
                <Route path="kosten" element={<CostItemsPage />} />
                <Route path="vertraege" element={<ContractsPage />} />
                <Route path="personen" element={<PersonsPage />} />
                <Route path="parteien" element={<PartiesPage />} />
                <Route path="objekte" element={<ObjectsPage />} />
                <Route path="kategorien" element={<CategoriesPage />} />
                <Route path="tags" element={<TagsPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={['admin']} />}>
                <Route path="benutzer" element={<UsersPage />} />
                <Route path="smtp" element={<AdminSmtpPage />} />
                <Route path="verwaltung" element={<AdminDataPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemedApp />
    </QueryClientProvider>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../api'
import { HaushaltsRadarLogo } from '../assets/HaushaltsRadarLogo'

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/'
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resetAvailable, setResetAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    void authApi
      .passwordResetAvailable()
      .then((result) => {
        if (!cancelled) setResetAvailable(result.available)
      })
      .catch(() => {
        if (!cancelled) setResetAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(username, password, rememberMe)
      navigate(from, { replace: true })
    } catch {
      setError('Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 420, mx: 'auto', mt: 8 }}>
      <Card>
        <CardContent>
          <Stack spacing={2} component="form" onSubmit={onSubmit}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
              <Box sx={{ color: 'primary.main', display: 'flex' }}>
                <HaushaltsRadarLogo size={36} />
              </Box>
              <Typography variant="h5">HaushaltsRadar</Typography>
            </Stack>
            <Typography color="text.secondary" variant="body2">
              Anmelden für Dashboard, Struktur, Kostenübersicht und Historie (mindestens
              Lese-Zugang erforderlich).
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Benutzername"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              fullWidth
            />
            <TextField
              label="Passwort"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              fullWidth
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
              }
              label="Angemeldet bleiben"
            />
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? 'Anmeldung…' : 'Anmelden'}
            </Button>
            {resetAvailable && (
              <Link
                component={RouterLink}
                to="/passwort-vergessen"
                variant="body2"
                sx={{ textAlign: 'center' }}
              >
                Passwort vergessen?
              </Link>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}

import { useMemo, useState, type FormEvent } from 'react'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { ApiError } from '../api/client'
import { authApi } from '../api'
import { HaushaltsRadarLogo } from '../assets/HaushaltsRadarLogo'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = useMemo(() => params.get('token')?.trim() || '', [params])
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!token) {
      setError('Reset-Link ist ungültig oder unvollständig.')
      return
    }
    if (password.length < 6) {
      setError('Das neue Passwort muss mindestens 6 Zeichen haben.')
      return
    }
    if (password !== password2) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }
    setSubmitting(true)
    try {
      await authApi.confirmPasswordReset(token, password)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Passwort konnte nicht geändert werden.'
      setError(message)
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
              <Typography variant="h5">Neues Passwort</Typography>
            </Stack>
            <Typography color="text.secondary" variant="body2">
              Vergib ein neues Passwort für dein HaushaltsRadar-Konto.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {done && (
              <Alert severity="success">
                Passwort wurde geändert. Du wirst zur Anmeldung weitergeleitet…
              </Alert>
            )}
            {!done && (
              <>
                <TextField
                  label="Neues Passwort"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  fullWidth
                />
                <TextField
                  label="Passwort wiederholen"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  autoComplete="new-password"
                  required
                  fullWidth
                />
                <Button type="submit" variant="contained" disabled={submitting || !token}>
                  {submitting ? 'Speichern…' : 'Passwort speichern'}
                </Button>
              </>
            )}
            <Link
              component={RouterLink}
              to="/login"
              variant="body2"
              sx={{ textAlign: 'center' }}
            >
              Zurück zur Anmeldung
            </Link>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}

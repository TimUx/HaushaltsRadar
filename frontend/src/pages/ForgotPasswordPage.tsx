import { useState, type FormEvent } from 'react'
import { Link as RouterLink } from 'react-router-dom'
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

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setInfo(null)
    try {
      const result = await authApi.requestPasswordReset(identifier.trim())
      setInfo(result.detail)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Anfrage fehlgeschlagen. Bitte später erneut versuchen.'
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
              <Typography variant="h5">Passwort vergessen</Typography>
            </Stack>
            <Typography color="text.secondary" variant="body2">
              Gib deinen Benutzernamen oder deine E-Mail-Adresse ein. Wenn ein Konto existiert und
              SMTP aktiv ist, erhältst du einen Link zum Zurücksetzen.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {info && <Alert severity="success">{info}</Alert>}
            <TextField
              label="Benutzername oder E-Mail"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
              fullWidth
            />
            <Button type="submit" variant="contained" disabled={submitting || !identifier.trim()}>
              {submitting ? 'Wird gesendet…' : 'Link anfordern'}
            </Button>
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

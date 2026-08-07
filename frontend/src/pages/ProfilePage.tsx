import { useEffect, useState, type FormEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { ApiError } from '../api/client'
import { authApi } from '../api'
import { ROLE_LABELS } from '../api/types'
import { useAuth } from '../auth/AuthContext'

export function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [username, setUsername] = useState(user?.username || '')
  const [email, setEmail] = useState(user?.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setUsername(user?.username || '')
    setEmail(user?.email || '')
  }, [user])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (newPassword && newPassword !== newPassword2) {
      setError('Die neuen Passwörter stimmen nicht überein.')
      return
    }
    if (newPassword && newPassword.length < 6) {
      setError('Das neue Passwort muss mindestens 6 Zeichen haben.')
      return
    }
    if (newPassword && !currentPassword) {
      setError('Zum Ändern des Passworts musst du dein aktuelles Passwort angeben.')
      return
    }

    const body: {
      username?: string
      email?: string | null
      current_password?: string
      new_password?: string
    } = {
      username: username.trim(),
      email: email.trim() || null,
    }
    if (newPassword) {
      body.current_password = currentPassword
      body.new_password = newPassword
    }

    setSubmitting(true)
    try {
      await authApi.updateMe(body)
      await refreshUser()
      setCurrentPassword('')
      setNewPassword('')
      setNewPassword2('')
      setSuccess('Kontoeinstellungen wurden gespeichert.')
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return null

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Mein Konto
      </Typography>
      <Card>
        <CardContent>
          <Stack spacing={2} component="form" onSubmit={onSubmit}>
            <Typography color="text.secondary" variant="body2">
              Hier kannst du deine eigenen Kontodaten ändern. Rolle und Personenzuordnung
              werden nur vom Administrator verwaltet.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}
            <TextField
              label="Benutzername"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              fullWidth
              autoComplete="username"
            />
            <TextField
              label="E-Mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              autoComplete="email"
              helperText="Für Erinnerungen und Passwort-Zurücksetzen"
            />
            <TextField
              label="Rolle"
              value={ROLE_LABELS[user.role] || user.role}
              fullWidth
              disabled
            />
            <Divider />
            <Typography variant="subtitle1">Passwort ändern</Typography>
            <TextField
              label="Aktuelles Passwort"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              fullWidth
              autoComplete="current-password"
            />
            <TextField
              label="Neues Passwort"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              autoComplete="new-password"
            />
            <TextField
              label="Neues Passwort wiederholen"
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              fullWidth
              autoComplete="new-password"
            />
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? 'Speichern…' : 'Speichern'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}

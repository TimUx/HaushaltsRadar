import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { smtpApi } from '../api'
import type { SmtpSettings } from '../api/types'

const emptyForm: SmtpSettings = {
  enabled: false,
  host: '',
  port: 587,
  use_tls: true,
  use_ssl: false,
  username: '',
  password_set: false,
  from_email: '',
  from_name: 'HaushaltsRadar',
  default_cc_email: '',
  remind_days_before: '30,14,7,1',
}

export function AdminSmtpPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['smtp-settings'],
    queryFn: smtpApi.get,
  })
  const [form, setForm] = useState<SmtpSettings>(emptyForm)
  const [password, setPassword] = useState('')
  const [testTo, setTestTo] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (data) {
      setForm({
        ...data,
        host: data.host || '',
        username: data.username || '',
        from_email: data.from_email || '',
        from_name: data.from_name || '',
        default_cc_email: data.default_cc_email || '',
        remind_days_before: data.remind_days_before || '30,14,7,1',
      })
      setTestTo(data.default_cc_email || data.from_email || '')
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () =>
      smtpApi.update({
        enabled: form.enabled,
        host: form.host || null,
        port: form.port,
        use_tls: form.use_tls,
        use_ssl: form.use_ssl,
        username: form.username || null,
        from_email: form.from_email || null,
        from_name: form.from_name || null,
        default_cc_email: form.default_cc_email || null,
        remind_days_before: form.remind_days_before || '30,14,7,1',
        ...(password ? { password } : {}),
      }),
    onSuccess: async () => {
      setPassword('')
      setMessage('SMTP-Einstellungen gespeichert.')
      await queryClient.invalidateQueries({ queryKey: ['smtp-settings'] })
    },
    onError: (err: Error) => setMessage(err.message),
  })

  const testMutation = useMutation({
    mutationFn: () => smtpApi.test(testTo || undefined),
    onSuccess: (res) => setMessage(`Test-E-Mail gesendet an ${res.to}.`),
    onError: (err: Error) => setMessage(err.message),
  })

  const runMutation = useMutation({
    mutationFn: () => smtpApi.runReminders(),
    onSuccess: (res) => {
      if (res.status === 'skipped') {
        setMessage(res.reason || 'Erinnerungen übersprungen.')
        return
      }
      const errPart =
        res.errors?.length ? ` Fehler: ${res.errors.join(' | ')}` : ''
      setMessage(
        `Erinnerungen: ${res.sent} gesendet, ${res.skipped} übersprungen ` +
          `(${res.candidates} Kandidaten).${errPart}`,
      )
    },
    onError: (err: Error) => setMessage(err.message),
  })

  if (isLoading) {
    return <Typography color="text.secondary">Laden…</Typography>
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 720 }}>
      <Typography variant="body2" color="text.secondary">
        Bei aktiviertem SMTP prüft HaushaltsRadar täglich um 07:00 (Europe/Berlin) Verträge auf
        bevorstehende Kündigungsfristen und Vertragsenden. Empfänger sind verknüpfte Benutzer-
        bzw. Personen-E-Mails; die Default-Adresse erhält alles in CC. Ohne Zuordnung geht die
        Nachricht an die Default-Adresse.
      </Typography>

      {error && <Alert severity="error">Einstellungen konnten nicht geladen werden.</Alert>}
      {message && (
        <Alert
          severity={
            message.toLowerCase().includes('fehl') || message.toLowerCase().includes('error')
              ? 'error'
              : 'success'
          }
          onClose={() => setMessage(null)}
        >
          {message}
        </Alert>
      )}

      <FormControlLabel
        control={
          <Switch
            checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
          />
        }
        label="SMTP / Erinnerungen aktiv"
      />

      <TextField
        label="SMTP-Host"
        fullWidth
        value={form.host || ''}
        onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
      />
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Port"
          type="number"
          sx={{ width: 120 }}
          value={form.port}
          onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) || 587 }))}
        />
        <FormControlLabel
          control={
            <Switch
              checked={form.use_tls}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  use_tls: e.target.checked,
                  use_ssl: e.target.checked ? false : f.use_ssl,
                }))
              }
            />
          }
          label="STARTTLS"
        />
        <FormControlLabel
          control={
            <Switch
              checked={form.use_ssl}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  use_ssl: e.target.checked,
                  use_tls: e.target.checked ? false : f.use_tls,
                }))
              }
            />
          }
          label="SSL (z. B. Port 465)"
        />
      </Box>
      <TextField
        label="Benutzername"
        fullWidth
        value={form.username || ''}
        onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
      />
      <TextField
        label={form.password_set ? 'Passwort (leer = unverändert)' : 'Passwort'}
        type="password"
        fullWidth
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <TextField
        label="Absender-E-Mail"
        fullWidth
        value={form.from_email || ''}
        onChange={(e) => setForm((f) => ({ ...f, from_email: e.target.value }))}
      />
      <TextField
        label="Absender-Name"
        fullWidth
        value={form.from_name || ''}
        onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))}
      />
      <TextField
        label="Default-E-Mail (CC / Fallback)"
        fullWidth
        helperText="Erhält alle Erinnerungen in CC. Ohne Personen-/Parteien-Zuordnung auch als Empfänger."
        value={form.default_cc_email || ''}
        onChange={(e) => setForm((f) => ({ ...f, default_cc_email: e.target.value }))}
      />
      <TextField
        label="Erinnerungstage vor Stichtag"
        fullWidth
        helperText="Kommagetrennt, z. B. 30,14,7,1 – gilt für Kündigungsfrist und Vertragsende."
        value={form.remind_days_before}
        onChange={(e) => setForm((f) => ({ ...f, remind_days_before: e.target.value }))}
      />

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          Speichern
        </Button>
        <TextField
          label="Test an"
          size="small"
          value={testTo}
          onChange={(e) => setTestTo(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <Button
          variant="outlined"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending}
        >
          Test senden
        </Button>
        <Button
          variant="outlined"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending || !form.enabled}
        >
          Erinnerungen jetzt prüfen
        </Button>
      </Box>
    </Stack>
  )
}

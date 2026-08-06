import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/DownloadOutlined'
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined'
import BackupIcon from '@mui/icons-material/BackupOutlined'
import RestoreIcon from '@mui/icons-material/SettingsBackupRestoreOutlined'
import { adminDataApi } from '../api'

function backupFilename(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `haushaltsradar-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`
}

export function AdminDataPage() {
  const queryClient = useQueryClient()
  const importInputRef = useRef<HTMLInputElement>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const exportMutation = useMutation({
    mutationFn: (asBackup: boolean) =>
      adminDataApi.exportJson(asBackup ? backupFilename() : undefined),
    onSuccess: () => {
      setError(null)
      setMessage('Export gestartet — die JSON-Datei wird heruntergeladen.')
    },
    onError: (err: Error) => {
      setMessage(null)
      setError(err.message)
    },
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => adminDataApi.importJson(file),
    onSuccess: async (result) => {
      setConfirmOpen(false)
      setPendingFile(null)
      setError(null)
      const counts = Object.entries(result.imported || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
      setMessage(`Import erfolgreich. ${counts}`)
      await queryClient.invalidateQueries()
    },
    onError: (err: Error) => {
      setConfirmOpen(false)
      setMessage(null)
      setError(err.message)
    },
  })

  function requestImport(file: File | null | undefined) {
    if (!file) return
    setPendingFile(file)
    setConfirmOpen(true)
  }

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Vollständiger Datenbestand als JSON — inklusive Benutzer. Import ersetzt alle vorhandenen
        Daten.
      </Typography>

      {message && <Alert severity="success">{message}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Export / Import
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Daten sichern oder wieder einspielen. Geeignet zum Übertragen zwischen Instanzen.
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                disabled={exportMutation.isPending}
                onClick={() => exportMutation.mutate(false)}
              >
                JSON exportieren
              </Button>
              <Button
                variant="outlined"
                startIcon={<UploadFileIcon />}
                disabled={importMutation.isPending}
                onClick={() => importInputRef.current?.click()}
              >
                JSON importieren
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  requestImport(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Backup / Restore
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Notfall-Sicherung mit Zeitstempel im Dateinamen. Restore überschreibt den kompletten
              Bestand unwiderruflich.
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<BackupIcon />}
                disabled={exportMutation.isPending}
                onClick={() => exportMutation.mutate(true)}
              >
                Backup erstellen
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<RestoreIcon />}
                disabled={importMutation.isPending}
                onClick={() => restoreInputRef.current?.click()}
              >
                Backup wiederherstellen
              </Button>
              <input
                ref={restoreInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  requestImport(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Alle Daten ersetzen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Die Datei „{pendingFile?.name}“ ersetzt den gesamten aktuellen Datenbestand (Posten,
            Verträge, Organisation, Benutzer). Dieser Vorgang kann nicht rückgängig gemacht werden.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Abbrechen</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!pendingFile || importMutation.isPending}
            onClick={() => {
              if (pendingFile) importMutation.mutate(pendingFile)
            }}
          >
            Ersetzen
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

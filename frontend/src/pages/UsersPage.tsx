import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import EditIcon from '@mui/icons-material/EditOutlined'
import { personsApi, usersApi } from '../api'
import { ROLE_LABELS, type User, type UserRole } from '../api/types'
import { useAuth } from '../auth/AuthContext'

const ROLES = Object.keys(ROLE_LABELS) as UserRole[]

export function UsersPage() {
  const queryClient = useQueryClient()
  const { user: currentUser, refreshUser } = useAuth()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  })
  const { data: persons = [] } = useQuery({
    queryKey: ['persons'],
    queryFn: personsApi.list,
  })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [isActive, setIsActive] = useState(true)
  const [personId, setPersonId] = useState<number | ''>('')
  const [email, setEmail] = useState('')

  const personName = (id: number | null | undefined) =>
    id == null ? '–' : persons.find((p) => p.id === id)?.name || `#${id}`

  const saveMutation = useMutation({
    mutationFn: async () => {
      const linkedPerson = personId === '' ? null : personId
      const emailValue = email.trim() || null
      if (editing) {
        const body: {
          username: string
          role: UserRole
          is_active: boolean
          person_id: number | null
          email: string | null
          password?: string
        } = {
          username,
          role,
          is_active: isActive,
          person_id: linkedPerson,
          email: emailValue,
        }
        if (password) body.password = password
        return usersApi.update(editing.id, body)
      }
      return usersApi.create({
        username,
        password,
        email: emailValue,
        role,
        is_active: isActive,
        person_id: linkedPerson,
      })
    },
    onSuccess: async (saved) => {
      setOpen(false)
      setEditing(null)
      setUsername('')
      setPassword('')
      setEmail('')
      setRole('user')
      setIsActive(true)
      setPersonId('')
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      if (currentUser && saved.id === currentUser.id) {
        await refreshUser()
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  function openCreate() {
    setEditing(null)
    setUsername('')
    setPassword('')
    setEmail('')
    setRole('user')
    setIsActive(true)
    setPersonId('')
    setOpen(true)
  }

  function openEdit(user: User) {
    setEditing(user)
    setUsername(user.username)
    setPassword('')
    setEmail(user.email || '')
    setRole(user.role)
    setIsActive(user.is_active)
    setPersonId(user.person_id ?? '')
    setOpen(true)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editing && password.length < 6) return
    saveMutation.mutate()
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Administrator: alles · Benutzer: Verwaltung ohne Benutzer · Nur Lesen: Dashboard,
          Struktur, Kostenübersicht und Historie. Mit verknüpfter Person steht „Meine Finanzen“
          zur Verfügung.
        </Typography>
        <Button variant="contained" onClick={openCreate} sx={{ flexShrink: 0 }}>
          Benutzer hinzufügen
        </Button>
      </Box>
      {error && <Alert severity="error">Benutzer konnten nicht geladen werden.</Alert>}
      {(saveMutation.error || deleteMutation.error) && (
        <Alert severity="error">
          {((saveMutation.error || deleteMutation.error) as Error).message}
        </Alert>
      )}
      {isLoading ? (
        <Typography color="text.secondary">Laden…</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Benutzername</TableCell>
              <TableCell>E-Mail</TableCell>
              <TableCell>Rolle</TableCell>
              <TableCell>Person</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  {user.username}
                  {currentUser?.id === user.id ? ' (Sie)' : ''}
                </TableCell>
                <TableCell>{user.email || '–'}</TableCell>
                <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                <TableCell>{personName(user.person_id)}</TableCell>
                <TableCell>{user.is_active ? 'Aktiv' : 'Deaktiviert'}</TableCell>
                <TableCell align="right">
                  <IconButton aria-label="Bearbeiten" onClick={() => openEdit(user)} size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Löschen"
                    onClick={() => deleteMutation.mutate(user.id)}
                    size="small"
                    disabled={currentUser?.id === user.id}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={onSubmit}>
          <DialogTitle>{editing ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Benutzername"
                required
                fullWidth
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <TextField
                label={editing ? 'Neues Passwort (optional)' : 'Passwort'}
                type="password"
                required={!editing}
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                helperText={editing ? 'Leer lassen, um das Passwort nicht zu ändern' : 'Mindestens 6 Zeichen'}
              />
              <TextField
                label="E-Mail"
                type="email"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                helperText="Für Vertrags-Erinnerungen (hat Vorrang vor der Personen-E-Mail)"
              />
              <FormControl fullWidth>
                <InputLabel>Rolle</InputLabel>
                <Select
                  label="Rolle"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                >
                  {ROLES.map((r) => (
                    <MenuItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Verknüpfte Person</InputLabel>
                <Select
                  label="Verknüpfte Person"
                  value={personId === '' ? '' : String(personId)}
                  onChange={(e) => {
                    const value = e.target.value
                    setPersonId(value === '' ? '' : Number(value))
                  }}
                >
                  <MenuItem value="">Keine</MenuItem>
                  {persons
                    .filter((p) => p.is_active)
                    .map((person) => (
                      <MenuItem key={person.id} value={String(person.id)}>
                        {person.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                }
                label="Aktiv"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
              Speichern
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Stack>
  )
}

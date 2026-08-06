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
import { partiesApi, personsApi } from '../api'
import type { Person } from '../api/types'

export function PersonsPage() {
  const queryClient = useQueryClient()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['persons'],
    queryFn: personsApi.list,
  })
  const { data: parties = [] } = useQuery({
    queryKey: ['parties'],
    queryFn: partiesApi.list,
  })
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [partyId, setPartyId] = useState<number | ''>('')
  const [isActive, setIsActive] = useState(true)

  const partyName = (id?: number | null) =>
    id == null ? '–' : parties.find((p) => p.id === id)?.name || String(id)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        notes: notes || null,
        party_id: partyId === '' ? null : partyId,
        is_active: isActive,
      }
      if (editingId == null) return personsApi.create(body)
      return personsApi.update(editingId, body)
    },
    onSuccess: async () => {
      setOpen(false)
      setEditingId(null)
      setName('')
      setNotes('')
      setPartyId('')
      setIsActive(true)
      await queryClient.invalidateQueries({ queryKey: ['persons'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-filter-options'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => personsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['persons'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-filter-options'] })
    },
  })

  function openCreate() {
    setEditingId(null)
    setName('')
    setNotes('')
    setPartyId('')
    setIsActive(true)
    setOpen(true)
  }

  function openEdit(person: Person) {
    setEditingId(person.id)
    setName(person.name)
    setNotes(person.notes || '')
    setPartyId(person.party_id ?? '')
    setIsActive(person.is_active)
    setOpen(true)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    saveMutation.mutate()
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={openCreate}>
          Person hinzufügen
        </Button>
      </Box>
      {error && <Alert severity="error">Personen konnten nicht geladen werden.</Alert>}
      {saveMutation.error && (
        <Alert severity="error">{(saveMutation.error as Error).message}</Alert>
      )}
      {isLoading ? (
        <Typography color="text.secondary">Laden…</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Partei</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((person) => (
              <TableRow key={person.id}>
                <TableCell>{person.name}</TableCell>
                <TableCell>{partyName(person.party_id)}</TableCell>
                <TableCell>{person.is_active ? 'Aktiv' : 'Inaktiv'}</TableCell>
                <TableCell align="right">
                  <IconButton aria-label="Bearbeiten" onClick={() => openEdit(person)} size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Löschen"
                    onClick={() => deleteMutation.mutate(person.id)}
                    size="small"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <form onSubmit={onSubmit}>
          <DialogTitle>{editingId == null ? 'Neue Person' : 'Person bearbeiten'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                autoFocus
                label="Name"
                fullWidth
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <FormControl fullWidth>
                <InputLabel>Partei</InputLabel>
                <Select
                  label="Partei"
                  value={partyId === '' ? '' : String(partyId)}
                  onChange={(e) => {
                    const value = e.target.value
                    setPartyId(value === '' ? '' : Number(value))
                  }}
                >
                  <MenuItem value="">Keine Partei</MenuItem>
                  {parties.map((party) => (
                    <MenuItem key={party.id} value={String(party.id)}>
                      {party.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Notizen"
                fullWidth
                multiline
                minRows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
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

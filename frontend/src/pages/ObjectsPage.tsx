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
import { objectsApi, partiesApi, personsApi } from '../api'
import type { ObjectEntity } from '../api/types'

export function ObjectsPage() {
  const queryClient = useQueryClient()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['objects'],
    queryFn: objectsApi.list,
  })
  const { data: parties = [] } = useQuery({
    queryKey: ['parties'],
    queryFn: partiesApi.list,
  })
  const { data: persons = [] } = useQuery({
    queryKey: ['persons'],
    queryFn: personsApi.list,
  })
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [partyId, setPartyId] = useState<number | ''>('')
  const [personId, setPersonId] = useState<number | ''>('')
  const [isActive, setIsActive] = useState(true)

  const partyName = (id?: number | null) =>
    id == null ? '–' : parties.find((p) => p.id === id)?.name || String(id)
  const personName = (id?: number | null) =>
    id == null ? '–' : persons.find((p) => p.id === id)?.name || String(id)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        description: description || null,
        party_id: partyId === '' ? null : partyId,
        person_id: personId === '' ? null : personId,
        is_active: isActive,
      }
      if (editingId == null) return objectsApi.create(body)
      return objectsApi.update(editingId, body)
    },
    onSuccess: async () => {
      setOpen(false)
      setEditingId(null)
      setName('')
      setDescription('')
      setPartyId('')
      setPersonId('')
      setIsActive(true)
      await queryClient.invalidateQueries({ queryKey: ['objects'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-filter-options'] })
      await queryClient.invalidateQueries({ queryKey: ['structure'] })
      await queryClient.invalidateQueries({ queryKey: ['cost-overview'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => objectsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['objects'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-filter-options'] })
      await queryClient.invalidateQueries({ queryKey: ['structure'] })
      await queryClient.invalidateQueries({ queryKey: ['cost-overview'] })
    },
  })

  function openCreate() {
    setEditingId(null)
    setName('')
    setDescription('')
    setPartyId('')
    setPersonId('')
    setIsActive(true)
    setOpen(true)
  }

  function openEdit(obj: ObjectEntity) {
    setEditingId(obj.id)
    setName(obj.name)
    setDescription(obj.description || '')
    setPartyId(obj.party_id ?? '')
    setPersonId(obj.person_id ?? '')
    setIsActive(obj.is_active)
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
          Objekt hinzufügen
        </Button>
      </Box>
      {error && <Alert severity="error">Objekte konnten nicht geladen werden.</Alert>}
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
              <TableCell>Person</TableCell>
              <TableCell>Beschreibung</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((obj) => (
              <TableRow key={obj.id}>
                <TableCell>{obj.name}</TableCell>
                <TableCell>{partyName(obj.party_id)}</TableCell>
                <TableCell>{personName(obj.person_id)}</TableCell>
                <TableCell>{obj.description || '–'}</TableCell>
                <TableCell>{obj.is_active ? 'Aktiv' : 'Inaktiv'}</TableCell>
                <TableCell align="right">
                  <IconButton aria-label="Bearbeiten" onClick={() => openEdit(obj)} size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Löschen"
                    onClick={() => deleteMutation.mutate(obj.id)}
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

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={onSubmit}>
          <DialogTitle>{editingId == null ? 'Neues Objekt' : 'Objekt bearbeiten'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                required
                fullWidth
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
                    if (value !== '') setPersonId('')
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
              <FormControl fullWidth>
                <InputLabel>Person</InputLabel>
                <Select
                  label="Person"
                  value={personId === '' ? '' : String(personId)}
                  onChange={(e) => {
                    const value = e.target.value
                    setPersonId(value === '' ? '' : Number(value))
                    if (value !== '') setPartyId('')
                  }}
                >
                  <MenuItem value="">Keine Person</MenuItem>
                  {persons.map((person) => (
                    <MenuItem key={person.id} value={String(person.id)}>
                      {person.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Beschreibung"
                fullWidth
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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

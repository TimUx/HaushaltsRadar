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
  FormControlLabel,
  IconButton,
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
import { partiesApi } from '../api'
import type { Party } from '../api/types'

export function PartiesPage() {
  const queryClient = useQueryClient()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['parties'],
    queryFn: partiesApi.list,
  })
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { name, description: description || null, is_active: isActive }
      if (editingId == null) return partiesApi.create(body)
      return partiesApi.update(editingId, body)
    },
    onSuccess: async () => {
      setOpen(false)
      setEditingId(null)
      setName('')
      setDescription('')
      setIsActive(true)
      await queryClient.invalidateQueries({ queryKey: ['parties'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-filter-options'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => partiesApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['parties'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-filter-options'] })
    },
  })

  function openCreate() {
    setEditingId(null)
    setName('')
    setDescription('')
    setIsActive(true)
    setOpen(true)
  }

  function openEdit(party: Party) {
    setEditingId(party.id)
    setName(party.name)
    setDescription(party.description || '')
    setIsActive(party.is_active)
    setOpen(true)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    saveMutation.mutate()
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Wohnparteien / Etagen. Personen und Objekte können einer Partei zugeordnet werden;
          deren Kosten fließen im Überblick automatisch mit ein.
        </Typography>
        <Button variant="contained" onClick={openCreate} sx={{ flexShrink: 0 }}>
          Partei hinzufügen
        </Button>
      </Box>
      {error && <Alert severity="error">Parteien konnten nicht geladen werden.</Alert>}
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
              <TableCell>Beschreibung</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((party) => (
              <TableRow key={party.id}>
                <TableCell>{party.name}</TableCell>
                <TableCell>{party.description || '–'}</TableCell>
                <TableCell>{party.is_active ? 'Aktiv' : 'Inaktiv'}</TableCell>
                <TableCell align="right">
                  <IconButton aria-label="Bearbeiten" onClick={() => openEdit(party)} size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Löschen"
                    onClick={() => deleteMutation.mutate(party.id)}
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
          <DialogTitle>{editingId == null ? 'Neue Partei' : 'Partei bearbeiten'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                required
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. EG / Partei A"
              />
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

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
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import { categoriesApi } from '../api'
import type { Category } from '../api/types'

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })

  const [editOpen, setEditOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState('0')

  const updateMutation = useMutation({
    mutationFn: () =>
      categoriesApi.update(editing!.id, {
        name,
        sort_order: Number(sortOrder),
      }),
    onSuccess: async () => {
      setEditOpen(false)
      setEditing(null)
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-filter-options'] })
    },
  })

  const createMutation = useMutation({
    mutationFn: () =>
      categoriesApi.create({
        name,
        sort_order: Number(sortOrder),
      }),
    onSuccess: async () => {
      setCreateOpen(false)
      setName('')
      setSortOrder('0')
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-filter-options'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoriesApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-filter-options'] })
    },
  })

  function openEdit(category: Category) {
    setEditing(category)
    setName(category.name)
    setSortOrder(String(category.sort_order))
    setEditOpen(true)
  }

  function openCreate() {
    setName('')
    setSortOrder(String(data.length))
    setCreateOpen(true)
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Eine Hauptkategorie je Kostenposition. Feinere Labels pflegen Sie unter Tags.
        </Typography>
        <Button variant="contained" onClick={openCreate} sx={{ flexShrink: 0 }}>
          Kategorie hinzufügen
        </Button>
      </Box>
      {error && <Alert severity="error">Kategorien konnten nicht geladen werden.</Alert>}
      {(updateMutation.error || createMutation.error || deleteMutation.error) && (
        <Alert severity="error">
          {(
            (updateMutation.error || createMutation.error || deleteMutation.error) as Error
          ).message}
        </Alert>
      )}
      {isLoading ? (
        <Typography color="text.secondary">Laden…</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Sortierung</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((category) => (
              <TableRow key={category.id}>
                <TableCell>{category.name}</TableCell>
                <TableCell>{category.sort_order}</TableCell>
                <TableCell align="right">
                  <IconButton aria-label="Bearbeiten" onClick={() => openEdit(category)} size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Löschen"
                    onClick={() => deleteMutation.mutate(category.id)}
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

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="xs">
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            updateMutation.mutate()
          }}
        >
          <DialogTitle>Kategorie bearbeiten</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                required
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <TextField
                label="Sortierung"
                type="number"
                fullWidth
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Abbrechen</Button>
            <Button type="submit" variant="contained" disabled={updateMutation.isPending}>
              Speichern
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            createMutation.mutate()
          }}
        >
          <DialogTitle>Neue Kategorie</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                required
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <TextField
                label="Sortierung"
                type="number"
                fullWidth
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)}>Abbrechen</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>
              Speichern
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Stack>
  )
}

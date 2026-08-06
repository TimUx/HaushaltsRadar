import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import AddIcon from '@mui/icons-material/Add'
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
  const [subOpen, setSubOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [subName, setSubName] = useState('')
  const [parentId, setParentId] = useState<number | null>(null)

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
    },
  })

  const createMutation = useMutation({
    mutationFn: () =>
      categoriesApi.create({
        name,
        sort_order: Number(sortOrder),
        subcategories: [],
      }),
    onSuccess: async () => {
      setCreateOpen(false)
      setName('')
      setSortOrder('0')
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })

  const createSubMutation = useMutation({
    mutationFn: () => categoriesApi.createSubcategory(parentId!, { name: subName, sort_order: 0 }),
    onSuccess: async () => {
      setSubOpen(false)
      setSubName('')
      setParentId(null)
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
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

  function openSub(category: Category) {
    setParentId(category.id)
    setSubName('')
    setSubOpen(true)
  }

  function onEditSubmit(event: FormEvent) {
    event.preventDefault()
    updateMutation.mutate()
  }

  function onCreateSubmit(event: FormEvent) {
    event.preventDefault()
    createMutation.mutate()
  }

  function onSubSubmit(event: FormEvent) {
    event.preventDefault()
    createSubMutation.mutate()
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Standardkategorien werden beim Start automatisch angelegt.
        </Typography>
        <Button variant="contained" onClick={openCreate} sx={{ flexShrink: 0 }}>
          Kategorie hinzufügen
        </Button>
      </Box>
      {error && <Alert severity="error">Kategorien konnten nicht geladen werden.</Alert>}
      {(updateMutation.error || createMutation.error || createSubMutation.error) && (
        <Alert severity="error">
          {(
            (updateMutation.error || createMutation.error || createSubMutation.error) as Error
          ).message}
        </Alert>
      )}
      {isLoading && <Typography color="text.secondary">Laden…</Typography>}
      {data.map((category) => (
        <Card key={category.id}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">{category.name}</Typography>
              <Box>
                <IconButton aria-label="Unterkategorie" onClick={() => openSub(category)} size="small">
                  <AddIcon fontSize="small" />
                </IconButton>
                <IconButton aria-label="Bearbeiten" onClick={() => openEdit(category)} size="small">
                  <EditIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {category.subcategories.map((sub) => (
                <Chip key={sub.id} label={sub.name} variant="outlined" size="small" />
              ))}
              {category.subcategories.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Keine Unterkategorien
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      ))}

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="xs">
        <form onSubmit={onEditSubmit}>
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
        <form onSubmit={onCreateSubmit}>
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

      <Dialog open={subOpen} onClose={() => setSubOpen(false)} fullWidth maxWidth="xs">
        <form onSubmit={onSubSubmit}>
          <DialogTitle>Unterkategorie hinzufügen</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Name"
              required
              fullWidth
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSubOpen(false)}>Abbrechen</Button>
            <Button type="submit" variant="contained" disabled={createSubMutation.isPending}>
              Speichern
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Stack>
  )
}

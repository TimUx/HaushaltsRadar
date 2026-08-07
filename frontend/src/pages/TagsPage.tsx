import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { tagsApi } from '../api'
import type { Tag } from '../api/types'

export function TagsPage() {
  const queryClient = useQueryClient()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.list,
  })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [name, setName] = useState('')

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) return tagsApi.update(editing.id, { name })
      return tagsApi.create({ name })
    },
    onSuccess: async () => {
      setOpen(false)
      setEditing(null)
      setName('')
      await queryClient.invalidateQueries({ queryKey: ['tags'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-filter-options'] })
      await queryClient.invalidateQueries({ queryKey: ['cost-items'] })
      await queryClient.invalidateQueries({ queryKey: ['cost-overview'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tagsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tags'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-filter-options'] })
      await queryClient.invalidateQueries({ queryKey: ['cost-items'] })
      await queryClient.invalidateQueries({ queryKey: ['cost-overview'] })
    },
  })

  function openCreate() {
    setEditing(null)
    setName('')
    setOpen(true)
  }

  function openEdit(tag: Tag) {
    setEditing(tag)
    setName(tag.name)
    setOpen(true)
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Tags können mehrfach an Posten vergeben werden (z.&nbsp;B. Strom, Internet, KFZ).
        </Typography>
        <Button variant="contained" onClick={openCreate} sx={{ flexShrink: 0 }}>
          Tag hinzufügen
        </Button>
      </Box>
      {error && <Alert severity="error">Tags konnten nicht geladen werden.</Alert>}
      {(saveMutation.error || deleteMutation.error) && (
        <Alert severity="error">
          {((saveMutation.error || deleteMutation.error) as Error).message}
        </Alert>
      )}
      {isLoading ? (
        <Typography color="text.secondary">Laden…</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {data.length === 0 && (
            <Typography color="text.secondary">Noch keine Tags angelegt.</Typography>
          )}
          {data.map((tag) => (
            <Chip
              key={tag.id}
              label={tag.name}
              onClick={() => openEdit(tag)}
              onDelete={() => deleteMutation.mutate(tag.id)}
              variant="outlined"
            />
          ))}
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            saveMutation.mutate()
          }}
        >
          <DialogTitle>{editing ? 'Tag bearbeiten' : 'Neuer Tag'}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Name"
              required
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
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

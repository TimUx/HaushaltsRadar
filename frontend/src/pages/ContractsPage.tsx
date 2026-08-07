import { useMemo, useState, type FormEvent } from 'react'
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
import { contractsApi, costItemsApi, partiesApi, personsApi } from '../api'
import type { Contract, CostItem } from '../api/types'
import {
  AllocationEditor,
  allocationTotal,
  allocationsPayload,
  draftsFromAllocations,
  emptyAllocation,
  type AllocationDraft,
} from '../components/AllocationEditor'

type FormState = {
  provider: string
  costItemId: number | ''
  noticeDays: string
  endDate: string
  contractNumber: string
  autoRenewal: boolean
  notes: string
  allocations: AllocationDraft[]
}

function defaultForm(): FormState {
  return {
    provider: '',
    costItemId: '',
    noticeDays: '90',
    endDate: '',
    contractNumber: '',
    autoRenewal: true,
    notes: '',
    allocations: [emptyAllocation(true)],
  }
}

export function ContractsPage() {
  const queryClient = useQueryClient()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['contracts'],
    queryFn: contractsApi.list,
  })
  const { data: costItems = [] } = useQuery({
    queryKey: ['cost-items'],
    queryFn: costItemsApi.list,
  })
  const { data: persons = [] } = useQuery({
    queryKey: ['persons'],
    queryFn: personsApi.list,
  })
  const { data: parties = [] } = useQuery({
    queryKey: ['parties'],
    queryFn: partiesApi.list,
  })

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm())
  const [formError, setFormError] = useState<string | null>(null)

  const costItemById = useMemo(() => {
    const map = new Map<number, CostItem>()
    costItems.forEach((item) => map.set(item.id, item))
    return map
  }, [costItems])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const costItemId = Number(form.costItemId)
      const contractPayload = {
        provider: form.provider,
        cost_item_id: costItemId,
        notice_period_days: form.noticeDays ? Number(form.noticeDays) : null,
        end_date: form.endDate || null,
        contract_number: form.contractNumber || null,
        auto_renewal: form.autoRenewal,
        notes: form.notes || null,
      }

      let contract: Contract
      if (editingId == null) {
        contract = await contractsApi.create(contractPayload)
      } else {
        contract = await contractsApi.update(editingId, {
          provider: form.provider,
          notice_period_days: form.noticeDays ? Number(form.noticeDays) : null,
          end_date: form.endDate || null,
          contract_number: form.contractNumber || null,
          auto_renewal: form.autoRenewal,
          notes: form.notes || null,
        })
      }

      await costItemsApi.update(costItemId, {
        allocations: allocationsPayload(form.allocations),
      })

      return contract
    },
    onSuccess: async () => {
      setOpen(false)
      setEditingId(null)
      setForm(defaultForm())
      setFormError(null)
      await queryClient.invalidateQueries({ queryKey: ['contracts'] })
      await queryClient.invalidateQueries({ queryKey: ['cost-items'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => contractsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['contracts'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  function applyCostItemAllocations(costItemId: number | '') {
    if (costItemId === '') {
      setForm((f) => ({ ...f, allocations: [emptyAllocation(true)] }))
      return
    }
    const item = costItemById.get(costItemId)
    setForm((f) => ({
      ...f,
      costItemId,
      allocations: item ? draftsFromAllocations(item.allocations) : [emptyAllocation(true)],
    }))
  }

  function openCreate() {
    setEditingId(null)
    setForm(defaultForm())
    setFormError(null)
    setOpen(true)
  }

  function openEdit(contract: Contract) {
    const item = costItemById.get(contract.cost_item_id)
    setEditingId(contract.id)
    setForm({
      provider: contract.provider,
      costItemId: contract.cost_item_id,
      noticeDays:
        contract.notice_period_days != null ? String(contract.notice_period_days) : '',
      endDate: contract.end_date || '',
      contractNumber: contract.contract_number || '',
      autoRenewal: contract.auto_renewal,
      notes: contract.notes || '',
      allocations: item ? draftsFromAllocations(item.allocations) : [emptyAllocation(true)],
    })
    setFormError(null)
    setOpen(true)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (form.costItemId === '') return
    if (Math.abs(allocationTotal(form.allocations) - 100) > 0.001) {
      setFormError('Die Kostenverteilung muss genau 100 % ergeben.')
      return
    }
    for (const row of form.allocations) {
      if (row.is_household) continue
      if (row.person_id === '' && row.party_id === '') {
        setFormError('Jeder Anteil benötigt Haushalt, Person oder Partei.')
        return
      }
    }
    setFormError(null)
    saveMutation.mutate()
  }

  const costItemName = (id: number) => costItemById.get(id)?.name || String(id)

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={openCreate}>
          Vertrag hinzufügen
        </Button>
      </Box>
      {error && <Alert severity="error">Verträge konnten nicht geladen werden.</Alert>}
      {saveMutation.error && (
        <Alert severity="error">{(saveMutation.error as Error).message}</Alert>
      )}
      {isLoading ? (
        <Typography color="text.secondary">Laden…</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Anbieter</TableCell>
              <TableCell>Kostenposition</TableCell>
              <TableCell>Vertragsende</TableCell>
              <TableCell>Kündigungsfrist</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell>{contract.provider}</TableCell>
                <TableCell>{costItemName(contract.cost_item_id)}</TableCell>
                <TableCell>{contract.end_date || '–'}</TableCell>
                <TableCell>
                  {contract.notice_period_days != null
                    ? `${contract.notice_period_days} Tage`
                    : '–'}
                </TableCell>
                <TableCell align="right">
                  <IconButton aria-label="Bearbeiten" onClick={() => openEdit(contract)} size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Löschen"
                    onClick={() => deleteMutation.mutate(contract.id)}
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
          <DialogTitle>{editingId == null ? 'Neuer Vertrag' : 'Vertrag bearbeiten'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {formError && <Alert severity="error">{formError}</Alert>}
              <TextField
                label="Anbieter"
                required
                fullWidth
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              />
              <FormControl fullWidth required disabled={editingId != null}>
                <InputLabel>Kostenposition</InputLabel>
                <Select
                  label="Kostenposition"
                  value={form.costItemId}
                  onChange={(e) => applyCostItemAllocations(Number(e.target.value))}
                >
                  {costItems.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Vertragsnummer"
                fullWidth
                value={form.contractNumber}
                onChange={(e) => setForm((f) => ({ ...f, contractNumber: e.target.value }))}
              />
              <TextField
                label="Vertragsende"
                type="date"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                helperText="Benötigt für Erinnerungen zu Kündigungsfrist und Vertragsende"
              />
              <TextField
                label="Kündigungsfrist (Tage)"
                type="number"
                fullWidth
                value={form.noticeDays}
                onChange={(e) => setForm((f) => ({ ...f, noticeDays: e.target.value }))}
              />
              <TextField
                label="Notizen"
                fullWidth
                multiline
                minRows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.autoRenewal}
                    onChange={(e) => setForm((f) => ({ ...f, autoRenewal: e.target.checked }))}
                  />
                }
                label="Automatische Verlängerung"
              />
              <AllocationEditor
                persons={persons}
                parties={parties}
                value={form.allocations}
                onChange={(allocations) => setForm((f) => ({ ...f, allocations }))}
              />
              <Typography variant="caption" color="text.secondary">
                Die Verteilung wird an der verknüpften Kostenposition gespeichert.
              </Typography>
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

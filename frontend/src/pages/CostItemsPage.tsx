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
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
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
import { categoriesApi, costItemsApi, objectsApi, partiesApi, personsApi } from '../api'
import { INTERVAL_LABELS, type CostItem, type PaymentInterval, MONTH_LABELS, intervalNeedsDueMonth } from '../api/types'
import { formatCurrency } from '../utils/format'
import {
  AllocationEditor,
  allocationTotal,
  allocationsPayload,
  draftsFromAllocations,
  emptyAllocation,
  type AllocationDraft,
} from '../components/AllocationEditor'

const INTERVALS = Object.keys(INTERVAL_LABELS) as PaymentInterval[]

type FormState = {
  name: string
  amount: string
  categoryId: number | ''
  subcategoryId: number | ''
  objectId: number | ''
  interval: PaymentInterval
  dueDay: string
  dueMonth: number | ''
  partner: string
  allocations: AllocationDraft[]
}

function defaultForm(categoryId: number | '' = ''): FormState {
  return {
    name: '',
    amount: '100',
    categoryId,
    subcategoryId: '',
    objectId: '',
    interval: 'monthly',
    dueDay: '1',
    dueMonth: '',
    partner: '',
    allocations: [emptyAllocation(true)],
  }
}

function formFromItem(item: CostItem): FormState {
  return {
    name: item.name,
    amount: String(item.amount),
    categoryId: item.category_id,
    subcategoryId: item.subcategory_id ?? '',
    objectId: item.object_id ?? '',
    interval: item.payment_interval,
    dueDay: item.due_day != null ? String(item.due_day) : '',
    dueMonth: item.due_month ?? '',
    partner: item.contract_partner || '',
    allocations: draftsFromAllocations(item.allocations),
  }
}

function formatAllocations(
  item: CostItem,
  personName: (id: number) => string,
  partyName: (id: number) => string,
): string {
  if (!item.allocations.length) return 'Haushalt 100 %'
  return item.allocations
    .map((a) => {
      const target = a.is_household
        ? 'Haushalt'
        : a.party_id
          ? partyName(a.party_id)
          : a.person_id
            ? personName(a.person_id)
            : 'Unbekannt'
      return `${target} ${Number(a.percentage)} %`
    })
    .join(', ')
}

export function CostItemsPage() {
  const queryClient = useQueryClient()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['cost-items'],
    queryFn: costItemsApi.list,
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })
  const { data: objects = [] } = useQuery({
    queryKey: ['objects'],
    queryFn: objectsApi.list,
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

  const categoryLabel = useMemo(() => {
    const categoriesById = new Map(categories.map((c) => [c.id, c]))
    const subcategoriesById = new Map(
      categories.flatMap((c) => c.subcategories.map((s) => [s.id, { categoryId: c.id, name: s.name }] as const)),
    )
    return (categoryId: number, subcategoryId?: number | null) => {
      const category = categoriesById.get(categoryId)?.name || String(categoryId)
      if (subcategoryId == null) return category
      const sub = subcategoriesById.get(subcategoryId)
      return sub ? `${category} / ${sub.name}` : category
    }
  }, [categories])

  const availableSubcategories = useMemo(() => {
    if (form.categoryId === '') return []
    return categories.find((c) => c.id === form.categoryId)?.subcategories ?? []
  }, [categories, form.categoryId])

  const personName = useMemo(() => {
    const map = new Map(persons.map((p) => [p.id, p.name]))
    return (id: number) => map.get(id) || String(id)
  }, [persons])

  const partyName = useMemo(() => {
    const map = new Map(parties.map((p) => [p.id, p.name]))
    return (id: number) => map.get(id) || String(id)
  }, [parties])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        amount: Number(form.amount),
        category_id: form.categoryId,
        subcategory_id: form.subcategoryId === '' ? null : form.subcategoryId,
        object_id: form.objectId === '' ? null : form.objectId,
        payment_interval: form.interval,
        due_day: form.dueDay ? Number(form.dueDay) : null,
        due_month:
          intervalNeedsDueMonth(form.interval) && form.dueMonth !== ''
            ? Number(form.dueMonth)
            : null,
        contract_partner: form.partner || null,
        currency: 'EUR',
        is_active: true,
        allocations: allocationsPayload(form.allocations),
      }
      if (editingId == null) {
        return costItemsApi.create(payload)
      }
      return costItemsApi.update(editingId, payload)
    },
    onSuccess: async () => {
      setOpen(false)
      setEditingId(null)
      setForm(defaultForm())
      setFormError(null)
      await queryClient.invalidateQueries({ queryKey: ['cost-items'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => costItemsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cost-items'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  function openCreate() {
    setEditingId(null)
    setForm(defaultForm(categories[0]?.id ?? ''))
    setFormError(null)
    setOpen(true)
  }

  function openEdit(item: CostItem) {
    setEditingId(item.id)
    setForm(formFromItem(item))
    setFormError(null)
    setOpen(true)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (form.categoryId === '') return
    if (intervalNeedsDueMonth(form.interval) && form.dueDay && form.dueMonth === '') {
      setFormError('Bitte Fälligkeitsmonat angeben.')
      return
    }
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

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={openCreate}>
          Kosten hinzufügen
        </Button>
      </Box>
      {error && <Alert severity="error">Kosten konnten nicht geladen werden.</Alert>}
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
              <TableCell>Kategorie</TableCell>
              <TableCell>Verteilung</TableCell>
              <TableCell>Intervall</TableCell>
              <TableCell align="right">Betrag</TableCell>
              <TableCell align="right">Monatlich</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{categoryLabel(item.category_id, item.subcategory_id)}</TableCell>
                <TableCell>{formatAllocations(item, personName, partyName)}</TableCell>
                <TableCell>{INTERVAL_LABELS[item.payment_interval]}</TableCell>
                <TableCell align="right">{formatCurrency(item.amount, item.currency)}</TableCell>
                <TableCell align="right">{formatCurrency(item.monthly_amount, item.currency)}</TableCell>
                <TableCell align="right">
                  <IconButton aria-label="Bearbeiten" onClick={() => openEdit(item)} size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Löschen"
                    onClick={() => deleteMutation.mutate(item.id)}
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
          <DialogTitle>
            {editingId == null ? 'Neue Kostenposition' : 'Kostenposition bearbeiten'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {formError && <Alert severity="error">{formError}</Alert>}
              <TextField
                label="Name"
                required
                fullWidth
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <TextField
                label="Betrag"
                type="number"
                required
                fullWidth
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
              />
              <FormControl fullWidth required>
                <InputLabel>Kategorie</InputLabel>
                <Select
                  label="Kategorie"
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      categoryId: Number(e.target.value),
                      subcategoryId: '',
                    }))
                  }
                >
                  {categories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth disabled={form.categoryId === '' || availableSubcategories.length === 0}>
                <InputLabel>Unterkategorie</InputLabel>
                <Select
                  label="Unterkategorie"
                  value={form.subcategoryId === '' ? '' : form.subcategoryId}
                  onChange={(e) => {
                    const value = e.target.value as number | ''
                    setForm((f) => ({
                      ...f,
                      subcategoryId: value === '' ? '' : Number(value),
                    }))
                  }}
                >
                  <MenuItem value="">Keine Unterkategorie</MenuItem>
                  {availableSubcategories.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Objekt</InputLabel>
                <Select
                  label="Objekt"
                  value={form.objectId === '' ? '' : form.objectId}
                  onChange={(e) => {
                    const value = e.target.value as number | ''
                    setForm((f) => ({
                      ...f,
                      objectId: value === '' ? '' : Number(value),
                    }))
                  }}
                >
                  <MenuItem value="">Kein Objekt</MenuItem>
                  {objects.map((o) => (
                    <MenuItem key={o.id} value={o.id}>
                      {o.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Intervall</InputLabel>
                <Select
                  label="Intervall"
                  value={form.interval}
                  onChange={(e) => {
                    const interval = e.target.value as PaymentInterval
                    setForm((f) => ({
                      ...f,
                      interval,
                      dueMonth:
                        intervalNeedsDueMonth(interval)
                          ? f.dueMonth === ''
                            ? 1
                            : f.dueMonth
                          : '',
                    }))
                  }}
                >
                  {INTERVALS.map((key) => (
                    <MenuItem key={key} value={key}>
                      {INTERVAL_LABELS[key]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Fälligkeitstag"
                  type="number"
                  fullWidth
                  value={form.dueDay}
                  onChange={(e) => setForm((f) => ({ ...f, dueDay: e.target.value }))}
                  slotProps={{ htmlInput: { min: 1, max: 31 } }}
                  helperText={
                    intervalNeedsDueMonth(form.interval)
                      ? 'Tag im Fälligkeitsmonat'
                      : 'Tag im Monat'
                  }
                />
                {intervalNeedsDueMonth(form.interval) && (
                  <FormControl fullWidth required>
                    <InputLabel>Fälligkeitsmonat</InputLabel>
                    <Select
                      label="Fälligkeitsmonat"
                      value={form.dueMonth === '' ? '' : form.dueMonth}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, dueMonth: Number(e.target.value) }))
                      }
                    >
                      {Object.entries(MONTH_LABELS).map(([value, label]) => (
                        <MenuItem key={value} value={Number(value)}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
              <TextField
                label="Vertragspartner"
                fullWidth
                value={form.partner}
                onChange={(e) => setForm((f) => ({ ...f, partner: e.target.value }))}
              />
              <AllocationEditor
                persons={persons}
                parties={parties}
                value={form.allocations}
                onChange={(allocations) => setForm((f) => ({ ...f, allocations }))}
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

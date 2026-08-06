import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import EditIcon from '@mui/icons-material/EditOutlined'
import PauseCircleOutlinedIcon from '@mui/icons-material/PauseCircleOutlined'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { categoriesApi, costItemsApi, objectsApi, partiesApi, personsApi, tagsApi } from '../api'
import {
  ENTRY_TYPE_LABELS,
  INTERVAL_LABELS,
  MONTH_LABELS,
  intervalNeedsDueMonth,
  type CostItem,
  type EntryType,
  type PaymentInterval,
} from '../api/types'
import { formatCurrency } from '../utils/format'
import {
  AllocationEditor,
  allocationTotal,
  allocationsPayload,
  draftsFromAllocations,
  emptyAllocation,
  type AllocationDraft,
} from '../components/AllocationEditor'
import { MyFinancesButton } from '../components/MyFinancesButton'
import { useAuth } from '../auth/AuthContext'
import { costItemBelongsToPerson } from '../utils/myFinances'

const INTERVALS = Object.keys(INTERVAL_LABELS) as PaymentInterval[]
const ENTRY_TYPES = Object.keys(ENTRY_TYPE_LABELS) as EntryType[]

type FormState = {
  name: string
  amount: string
  entryType: EntryType
  categoryId: number | ''
  tagIds: number[]
  objectId: number | ''
  interval: PaymentInterval
  startDate: string
  dueDay: string
  dueMonth: number | ''
  partner: string
  isActive: boolean
  allocations: AllocationDraft[]
  priceValidFrom: string
  originalAmount: string
  originalInterval: PaymentInterval | ''
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultForm(categoryId: number | '' = ''): FormState {
  return {
    name: '',
    amount: '100',
    entryType: 'expense',
    categoryId,
    tagIds: [],
    objectId: '',
    interval: 'monthly',
    startDate: '',
    dueDay: '1',
    dueMonth: '',
    partner: '',
    isActive: true,
    allocations: [emptyAllocation(true)],
    priceValidFrom: todayIso(),
    originalAmount: '',
    originalInterval: '',
  }
}

function formFromItem(item: CostItem): FormState {
  return {
    name: item.name,
    amount: String(item.amount),
    entryType: item.entry_type || 'expense',
    categoryId: item.category_id,
    tagIds: (item.tags || []).map((t) => t.id),
    objectId: item.object_id ?? '',
    interval: item.payment_interval,
    startDate: item.start_date || '',
    dueDay: item.due_day != null ? String(item.due_day) : '',
    dueMonth: item.due_month ?? '',
    partner: item.contract_partner || '',
    isActive: item.is_active,
    allocations: draftsFromAllocations(item.allocations),
    priceValidFrom: todayIso(),
    originalAmount: String(item.amount),
    originalInterval: item.payment_interval,
  }
}

const HISTORY_EVENT_LABELS: Record<string, string> = {
  created: 'Angelegt',
  changed: 'Geändert',
  ended: 'Beendet',
  reactivated: 'Reaktiviert',
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
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
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
  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.list,
  })

  const myFinances = searchParams.get('meine') === '1' && user?.person_id != null

  function setMyFinances(active: boolean) {
    const next = new URLSearchParams(searchParams)
    if (active) next.set('meine', '1')
    else next.delete('meine')
    setSearchParams(next, { replace: true })
  }

  const visibleItems = useMemo(() => {
    if (!myFinances || user?.person_id == null) return data
    return data.filter(
      (item) =>
        item.is_active && costItemBelongsToPerson(item, user.person_id!, objects),
    )
  }, [data, myFinances, user?.person_id, objects])

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [permanentTarget, setPermanentTarget] = useState<CostItem | null>(null)

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]))
    return (id: number) => map.get(id) || String(id)
  }, [categories])

  const personName = useMemo(() => {
    const map = new Map(persons.map((p) => [p.id, p.name]))
    return (id: number) => map.get(id) || String(id)
  }, [persons])

  const partyName = useMemo(() => {
    const map = new Map(parties.map((p) => [p.id, p.name]))
    return (id: number) => map.get(id) || String(id)
  }, [parties])

  const isOneTime = form.interval === 'one_time'
  const priceRelevantChange =
    editingId != null &&
    ((form.originalAmount !== '' && form.amount !== form.originalAmount) ||
      (form.originalInterval !== '' && form.interval !== form.originalInterval))
  const amountChanged = priceRelevantChange

  const { data: priceHistory = [], refetch: refetchPriceHistory } = useQuery({
    queryKey: ['cost-item-price-history', editingId],
    queryFn: () => costItemsApi.listPriceHistory(editingId!),
    enabled: open && editingId != null,
  })

  const [historyAmount, setHistoryAmount] = useState('')
  const [historyFrom, setHistoryFrom] = useState(todayIso())
  const [historyNotes, setHistoryNotes] = useState('')

  async function invalidateCostQueries() {
    await queryClient.invalidateQueries({ queryKey: ['cost-items'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['cost-overview'] })
    await queryClient.invalidateQueries({ queryKey: ['cost-history'] })
    if (editingId != null) {
      await queryClient.invalidateQueries({ queryKey: ['cost-item-price-history', editingId] })
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: form.name,
        amount: Number(form.amount),
        entry_type: form.entryType,
        category_id: form.categoryId,
        tag_ids: form.tagIds,
        object_id: form.objectId === '' ? null : form.objectId,
        payment_interval: form.interval,
        start_date: form.startDate || (isOneTime ? null : form.priceValidFrom || null),
        due_day: isOneTime ? null : form.dueDay ? Number(form.dueDay) : null,
        due_month:
          !isOneTime && intervalNeedsDueMonth(form.interval) && form.dueMonth !== ''
            ? Number(form.dueMonth)
            : null,
        contract_partner: form.partner || null,
        currency: 'EUR',
        is_active: form.isActive,
        allocations: allocationsPayload(form.allocations),
      }
      if (editingId == null) {
        return costItemsApi.create(payload)
      }
      if (priceRelevantChange) {
        payload.price_valid_from = form.priceValidFrom || todayIso()
      }
      return costItemsApi.update(editingId, payload)
    },
    onSuccess: async () => {
      setOpen(false)
      setEditingId(null)
      setForm(defaultForm())
      setFormError(null)
      await invalidateCostQueries()
    },
  })

  const addHistoryMutation = useMutation({
    mutationFn: async () => {
      if (editingId == null) throw new Error('Kein Posten gewählt')
      return costItemsApi.addPriceHistory(editingId, {
        amount: Number(historyAmount),
        valid_from: historyFrom,
        notes: historyNotes || null,
        sync_current_amount: false,
      })
    },
    onSuccess: async () => {
      setHistoryAmount('')
      setHistoryNotes('')
      setHistoryFrom(todayIso())
      await refetchPriceHistory()
      await invalidateCostQueries()
    },
  })

  const removeHistoryMutation = useMutation({
    mutationFn: (entryId: number) => {
      if (editingId == null) throw new Error('Kein Posten gewählt')
      return costItemsApi.removePriceHistory(editingId, entryId)
    },
    onSuccess: async () => {
      await refetchPriceHistory()
      await invalidateCostQueries()
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => costItemsApi.deactivate(id),
    onSuccess: async () => {
      await invalidateCostQueries()
    },
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: number) => costItemsApi.removePermanent(id),
    onSuccess: async () => {
      setPermanentTarget(null)
      await invalidateCostQueries()
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
    if (form.interval === 'one_time' && !form.startDate) {
      setFormError('Bitte Datum für den einmaligen Posten angeben.')
      return
    }
    if (
      !isOneTime &&
      intervalNeedsDueMonth(form.interval) &&
      form.dueDay &&
      form.dueMonth === ''
    ) {
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <MyFinancesButton active={myFinances} onToggle={() => setMyFinances(!myFinances)} />
        <Button variant="contained" onClick={openCreate}>
          Posten hinzufügen
        </Button>
      </Box>
      {error && <Alert severity="error">Posten konnten nicht geladen werden.</Alert>}
      {(saveMutation.error || deactivateMutation.error || permanentDeleteMutation.error) && (
        <Alert severity="error">
          {
            (
              (saveMutation.error ||
                deactivateMutation.error ||
                permanentDeleteMutation.error) as Error
            ).message
          }
        </Alert>
      )}
      {isLoading ? (
        <Typography color="text.secondary">Laden…</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Art</TableCell>
              <TableCell>Kategorie</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell>Verteilung</TableCell>
              <TableCell>Intervall</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Betrag</TableCell>
              <TableCell align="right">Monatlich</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleItems.map((item) => {
              const income = item.entry_type === 'income'
              return (
                <TableRow key={item.id} sx={{ opacity: item.is_active ? 1 : 0.55 }}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{ENTRY_TYPE_LABELS[item.entry_type || 'expense']}</TableCell>
                  <TableCell>{categoryName(item.category_id)}</TableCell>
                  <TableCell>
                    {(item.tags || []).map((t) => t.name).join(', ') || '–'}
                  </TableCell>
                  <TableCell>{formatAllocations(item, personName, partyName)}</TableCell>
                  <TableCell>{INTERVAL_LABELS[item.payment_interval]}</TableCell>
                  <TableCell>{item.is_active ? 'Aktiv' : 'Inaktiv'}</TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: income ? 'success.main' : 'inherit', fontWeight: income ? 600 : undefined }}
                  >
                    {income ? '−' : ''}
                    {formatCurrency(item.amount, item.currency)}
                  </TableCell>
                  <TableCell align="right">
                    {item.payment_interval === 'one_time'
                      ? '–'
                      : formatCurrency(item.monthly_amount, item.currency)}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Bearbeiten">
                      <IconButton aria-label="Bearbeiten" onClick={() => openEdit(item)} size="small">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {item.is_active && (
                      <Tooltip title="Deaktivieren (bleibt in Historie)">
                        <IconButton
                          aria-label="Deaktivieren"
                          onClick={() => deactivateMutation.mutate(item.id)}
                          size="small"
                        >
                          <PauseCircleOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Endgültig löschen">
                      <IconButton
                        aria-label="Endgültig löschen"
                        onClick={() => setPermanentTarget(item)}
                        size="small"
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={Boolean(permanentTarget)} onClose={() => setPermanentTarget(null)}>
        <DialogTitle>Endgültig löschen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            „{permanentTarget?.name}“ wird unwiderruflich gelöscht und erscheint nicht mehr in der
            Historie. Für gekündigte Verträge besser deaktivieren.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermanentTarget(null)}>Abbrechen</Button>
          <Button
            color="error"
            variant="contained"
            disabled={permanentDeleteMutation.isPending || !permanentTarget}
            onClick={() => {
              if (permanentTarget) permanentDeleteMutation.mutate(permanentTarget.id)
            }}
          >
            Endgültig löschen
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <form onSubmit={onSubmit}>
          <DialogTitle>
            {editingId == null ? 'Neuen Posten anlegen' : 'Posten bearbeiten'}
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
              <FormControl fullWidth required>
                <InputLabel>Art</InputLabel>
                <Select
                  label="Art"
                  value={form.entryType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, entryType: e.target.value as EntryType }))
                  }
                >
                  {ENTRY_TYPES.map((key) => (
                    <MenuItem key={key} value={key}>
                      {ENTRY_TYPE_LABELS[key]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Betrag"
                type="number"
                required
                fullWidth
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
                helperText="Betrag immer positiv; Art steuert Ausgabe oder Einnahme"
              />
              {!isOneTime && (
                <TextField
                  label={editingId == null ? 'Gültig ab' : 'Preisänderung gültig ab'}
                  type="date"
                  fullWidth
                  required={amountChanged}
                  value={form.priceValidFrom}
                  onChange={(e) => setForm((f) => ({ ...f, priceValidFrom: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                  helperText={
                    editingId == null
                      ? 'Ab diesem Datum gilt der Betrag in Historie und Jahresauswertung'
                      : amountChanged
                        ? 'Wichtig: legt fest, ab wann der neue Betrag in vergangenen Jahren gilt'
                        : 'Bei Betragsänderung: Stichtag für den Preisverlauf'
                  }
                />
              )}
              <FormControl fullWidth required>
                <InputLabel>Kategorie</InputLabel>
                <Select
                  label="Kategorie"
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      categoryId: Number(e.target.value),
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
              <FormControl fullWidth>
                <InputLabel>Tags</InputLabel>
                <Select
                  multiple
                  label="Tags"
                  value={form.tagIds}
                  onChange={(e) => {
                    const value = e.target.value
                    setForm((f) => ({
                      ...f,
                      tagIds: typeof value === 'string' ? [] : value,
                    }))
                  }}
                  input={<OutlinedInput label="Tags" />}
                  renderValue={(selected) =>
                    tags
                      .filter((t) => selected.includes(t.id))
                      .map((t) => t.name)
                      .join(', ')
                  }
                >
                  {tags.map((tag) => (
                    <MenuItem key={tag.id} value={tag.id}>
                      <Checkbox checked={form.tagIds.includes(tag.id)} />
                      <ListItemText primary={tag.name} />
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
                      startDate:
                        interval === 'one_time' && !f.startDate
                          ? new Date().toISOString().slice(0, 10)
                          : f.startDate,
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
              {isOneTime ? (
                <TextField
                  label="Datum"
                  type="date"
                  required
                  fullWidth
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                  helperText="Wirkt nur in diesem Monat (Nachzahlung, Erstattung, …)"
                />
              ) : (
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
              )}
              <TextField
                label="Vertragspartner"
                fullWidth
                value={form.partner}
                onChange={(e) => setForm((f) => ({ ...f, partner: e.target.value }))}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                }
                label="Aktiv"
              />
              <Typography variant="caption" color="text.secondary">
                Inaktiv = gekündigt (bleibt in Historie). Falscheingaben endgültig löschen.
              </Typography>
              {editingId != null && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2">Preisverlauf</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Jeder Eintrag gilt ab dem Datum bis zur nächsten Änderung — so bleiben
                    frühere Jahre in Dashboard und Historie korrekt.
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Gültig ab</TableCell>
                        <TableCell>Ereignis</TableCell>
                        <TableCell align="right">Betrag</TableCell>
                        <TableCell align="right">Monatlich</TableCell>
                        <TableCell>Hinweis</TableCell>
                        <TableCell align="right" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {priceHistory.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6}>Noch keine Verlaufseinträge</TableCell>
                        </TableRow>
                      )}
                      {priceHistory.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.valid_from}</TableCell>
                          <TableCell>
                            {HISTORY_EVENT_LABELS[entry.event_type] || entry.event_type}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(entry.amount)}</TableCell>
                          <TableCell align="right">{formatCurrency(entry.monthly_amount)}</TableCell>
                          <TableCell>{entry.notes || '–'}</TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              aria-label="Verlaufseintrag löschen"
                              onClick={() => removeHistoryMutation.mutate(entry.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                      label="Betrag"
                      type="number"
                      size="small"
                      value={historyAmount}
                      onChange={(e) => setHistoryAmount(e.target.value)}
                      slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
                      sx={{ width: 120 }}
                    />
                    <TextField
                      label="Gültig ab"
                      type="date"
                      size="small"
                      value={historyFrom}
                      onChange={(e) => setHistoryFrom(e.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={{ width: 160 }}
                    />
                    <TextField
                      label="Hinweis"
                      size="small"
                      value={historyNotes}
                      onChange={(e) => setHistoryNotes(e.target.value)}
                      sx={{ flex: 1, minWidth: 140 }}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={!historyAmount || !historyFrom || addHistoryMutation.isPending}
                      onClick={() => addHistoryMutation.mutate()}
                    >
                      Preisstand hinzufügen
                    </Button>
                  </Box>
                  {(addHistoryMutation.error || removeHistoryMutation.error) && (
                    <Alert severity="error">
                      {
                        ((addHistoryMutation.error || removeHistoryMutation.error) as Error)
                          .message
                      }
                    </Alert>
                  )}
                </>
              )}
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

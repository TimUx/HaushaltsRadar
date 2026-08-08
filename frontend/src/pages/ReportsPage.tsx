import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { analyticsApi, reportsApi, type PeriodType } from '../api'
import { formatCurrency } from '../utils/format'
import { exportPeriodReportPdf } from '../utils/exportPeriodReportPdf'
import { MyFinancesButton } from '../components/MyFinancesButton'
import { ResponsiveTable } from '../components/ResponsiveTable'
import { filterBarSx, filterControlSx } from '../theme/responsiveSx'
import { useAuth } from '../auth/AuthContext'

type ShareFilter = '' | 'household' | `person:${number}` | `party:${number}`

const PERIOD_OPTIONS: { id: PeriodType; label: string }[] = [
  { id: 'month', label: 'Monat' },
  { id: 'quarter', label: 'Quartal' },
  { id: 'half', label: 'Halbjahr' },
  { id: 'year', label: 'Jahr' },
  { id: 'custom', label: 'Zeitraum' },
]

const MONTH_OPTIONS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Box>
  )
}

export function ReportsPage() {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [periodType, setPeriodType] = useState<PeriodType>('year')
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [quarter, setQuarter] = useState(Math.ceil(currentMonth / 3))
  const [half, setHalf] = useState(currentMonth <= 6 ? 1 : 2)
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`)
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const [objectId, setObjectId] = useState<number | ''>('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [tagId, setTagId] = useState<number | ''>('')
  const [shareFilter, setShareFilter] = useState<ShareFilter>('')
  const [comment, setComment] = useState('')
  const [myFinances, setMyFinances] = useState(false)

  const effectiveShare: ShareFilter =
    myFinances && user?.person_id != null ? `person:${user.person_id}` : shareFilter

  const params = useMemo(() => {
    const base = {
      periodType,
      year,
      month: periodType === 'month' ? month : null,
      quarter: periodType === 'quarter' ? quarter : null,
      half: periodType === 'half' ? half : null,
      dateFrom: periodType === 'custom' ? dateFrom : null,
      dateTo: periodType === 'custom' ? dateTo : null,
      objectId: objectId === '' ? null : objectId,
      categoryId: categoryId === '' ? null : categoryId,
      tagId: tagId === '' ? null : tagId,
      personId: null as number | null,
      partyId: null as number | null,
      household: false,
      comment: comment.trim() || null,
    }
    if (effectiveShare === 'household') base.household = true
    else if (effectiveShare.startsWith('person:'))
      base.personId = Number(effectiveShare.slice(7))
    else if (effectiveShare.startsWith('party:')) base.partyId = Number(effectiveShare.slice(6))
    return base
  }, [
    periodType,
    year,
    month,
    quarter,
    half,
    dateFrom,
    dateTo,
    objectId,
    categoryId,
    tagId,
    effectiveShare,
    comment,
  ])

  const { data: filterOptions } = useQuery({
    queryKey: ['dashboard-filter-options'],
    queryFn: analyticsApi.filterOptions,
  })

  const yearOptions = useMemo(() => {
    const years = new Set(filterOptions?.years || [])
    years.add(currentYear)
    return Array.from(years).sort((a, b) => b - a)
  }, [filterOptions, currentYear])

  const reportQuery = useQuery({
    queryKey: ['period-report', params],
    queryFn: () => reportsApi.period(params),
  })

  const meta = useMemo(() => {
    const objectName =
      params.objectId != null
        ? filterOptions?.objects.find((o) => o.id === params.objectId)?.name ?? null
        : null
    const categoryName =
      params.categoryId != null
        ? filterOptions?.categories.find((c) => c.id === params.categoryId)?.name ?? null
        : null
    const tagName =
      params.tagId != null
        ? filterOptions?.tags.find((t) => t.id === params.tagId)?.name ?? null
        : null
    let shareLabel: string | null = null
    if (params.household) shareLabel = 'Haushalt'
    else if (params.personId != null)
      shareLabel = filterOptions?.persons.find((p) => p.id === params.personId)?.name ?? null
    else if (params.partyId != null)
      shareLabel = filterOptions?.parties.find((p) => p.id === params.partyId)?.name ?? null
    return { objectName, shareLabel, categoryName, tagName }
  }, [params, filterOptions])

  return (
    <Stack spacing={2.5}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h4" component="h1" sx={{ mr: 'auto', lineHeight: 1.2 }}>
          Berichte
        </Typography>
        <Button
          variant="contained"
          startIcon={<PictureAsPdfIcon />}
          disabled={!reportQuery.data || reportQuery.isFetching}
          onClick={() => {
            if (reportQuery.data) exportPeriodReportPdf(reportQuery.data, meta)
          }}
        >
          PDF herunterladen
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary">
        Periodenbericht mit Ausgaben, Einnahmen und Aufschlüsselungen für Archiv und Auswertung.
      </Typography>

      <Box sx={{ ...filterBarSx, justifyContent: { xs: 'stretch', sm: 'flex-start' } }}>
        <FormControl size="small" sx={filterControlSx}>
          <InputLabel>Periode</InputLabel>
          <Select
            label="Periode"
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value as PeriodType)}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {periodType !== 'custom' && (
          <FormControl size="small" sx={filterControlSx}>
            <InputLabel>Jahr</InputLabel>
            <Select label="Jahr" value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
              {yearOptions.map((y) => (
                <MenuItem key={y} value={String(y)}>
                  {y}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {periodType === 'month' && (
          <FormControl size="small" sx={filterControlSx}>
            <InputLabel>Monat</InputLabel>
            <Select label="Monat" value={String(month)} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_OPTIONS.map((name, idx) => (
                <MenuItem key={name} value={String(idx + 1)}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {periodType === 'quarter' && (
          <FormControl size="small" sx={filterControlSx}>
            <InputLabel>Quartal</InputLabel>
            <Select
              label="Quartal"
              value={String(quarter)}
              onChange={(e) => setQuarter(Number(e.target.value))}
            >
              {[1, 2, 3, 4].map((q) => (
                <MenuItem key={q} value={String(q)}>
                  {q}. Quartal
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {periodType === 'half' && (
          <FormControl size="small" sx={filterControlSx}>
            <InputLabel>Halbjahr</InputLabel>
            <Select label="Halbjahr" value={String(half)} onChange={(e) => setHalf(Number(e.target.value))}>
              <MenuItem value="1">1. Halbjahr</MenuItem>
              <MenuItem value="2">2. Halbjahr</MenuItem>
            </Select>
          </FormControl>
        )}
        {periodType === 'custom' && (
          <>
            <TextField
              size="small"
              type="date"
              label="Von"
              slotProps={{ inputLabel: { shrink: true } }}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <TextField
              size="small"
              type="date"
              label="Bis"
              slotProps={{ inputLabel: { shrink: true } }}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </>
        )}
        <FormControl size="small" sx={filterControlSx}>
          <InputLabel>Objekt</InputLabel>
          <Select
            label="Objekt"
            value={objectId === '' ? '' : String(objectId)}
            onChange={(e) => setObjectId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <MenuItem value="">Alle</MenuItem>
            {(filterOptions?.objects || []).map((obj) => (
              <MenuItem key={obj.id} value={String(obj.id)}>
                {obj.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={filterControlSx}>
          <InputLabel>Kategorie</InputLabel>
          <Select
            label="Kategorie"
            value={categoryId === '' ? '' : String(categoryId)}
            onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <MenuItem value="">Alle</MenuItem>
            {(filterOptions?.categories || []).map((cat) => (
              <MenuItem key={cat.id} value={String(cat.id)}>
                {cat.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={filterControlSx}>
          <InputLabel>Tag</InputLabel>
          <Select
            label="Tag"
            value={tagId === '' ? '' : String(tagId)}
            onChange={(e) => setTagId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <MenuItem value="">Alle</MenuItem>
            {(filterOptions?.tags || []).map((tag) => (
              <MenuItem key={tag.id} value={String(tag.id)}>
                {tag.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={filterControlSx}>
          <InputLabel>Anteil</InputLabel>
          <Select
            label="Anteil"
            value={myFinances ? '' : shareFilter}
            disabled={myFinances}
            onChange={(e) => setShareFilter(e.target.value as ShareFilter)}
          >
            <MenuItem value="">Alle</MenuItem>
            <MenuItem value="household">Haushalt</MenuItem>
            {(filterOptions?.parties || []).map((party) => (
              <MenuItem key={`party-${party.id}`} value={`party:${party.id}`}>
                {party.name}
              </MenuItem>
            ))}
            {(filterOptions?.persons || []).map((person) => (
              <MenuItem key={`person-${person.id}`} value={`person:${person.id}`}>
                {person.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <MyFinancesButton active={myFinances} onToggle={() => setMyFinances((v) => !v)} />
      </Box>

      <TextField
        label="Kommentar (optional, erscheint im PDF)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        fullWidth
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 2000 } }}
      />

      {reportQuery.isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      )}
      {reportQuery.error && (
        <Alert severity="error">{(reportQuery.error as Error).message}</Alert>
      )}

      {reportQuery.data && (
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {reportQuery.data.period_label}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {reportQuery.data.date_from} – {reportQuery.data.date_to} ·{' '}
                {reportQuery.data.months_covered} Monate · {reportQuery.data.summary.active_items}{' '}
                Positionen
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Kpi label="Ausgaben" value={formatCurrency(reportQuery.data.summary.expense_total)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Kpi label="Einnahmen" value={formatCurrency(reportQuery.data.summary.income_total)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Kpi label="Netto" value={formatCurrency(reportQuery.data.summary.net_total)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Kpi
                    label="Einmalig"
                    value={formatCurrency(reportQuery.data.summary.one_time_expense)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Nach Kategorie
              </Typography>
              <ResponsiveTable>
                <TableHead>
                  <TableRow>
                    <TableCell>Kategorie</TableCell>
                    <TableCell align="right">Betrag</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportQuery.data.by_category.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2}>Keine Daten</TableCell>
                    </TableRow>
                  )}
                  {reportQuery.data.by_category.map((row) => (
                    <TableRow key={`${row.id}-${row.name}`}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align="right">{formatCurrency(row.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </ResponsiveTable>
            </CardContent>
          </Card>
        </Stack>
      )}
    </Stack>
  )
}

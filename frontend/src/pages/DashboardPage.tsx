import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined'
import ReactECharts from 'echarts-for-react'
import { useSearchParams, Link as RouterLink } from 'react-router-dom'
import { analyticsApi } from '../api'
import { formatCurrency } from '../utils/format'
import { exportDashboardPdf } from '../utils/exportDashboardPdf'
import { INTERVAL_LABELS } from '../api/types'
import { MyFinancesButton } from '../components/MyFinancesButton'
import { useAuth } from '../auth/AuthContext'
import { buildBarOption, buildPieOption } from '../charts'

function KpiPanel({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          py: 2,
          '&:last-child': { pb: 2 },
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
          {value}
        </Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto' }}>
            {hint}
          </Typography>
        ) : (
          <Box sx={{ minHeight: 18 }} />
        )}
      </CardContent>
    </Card>
  )
}

function KpiSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack spacing={1.25}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ letterSpacing: '0.08em', lineHeight: 1 }}
      >
        {title}
      </Typography>
      <Grid container spacing={2}>
        {children}
      </Grid>
    </Stack>
  )
}

type ShareFilter = '' | 'household' | `person:${number}` | `party:${number}`

const selectSx = {
  minWidth: 140,
  maxWidth: 180,
  '& .MuiInputBase-root': { fontSize: 13 },
  '& .MuiInputLabel-root': { fontSize: 13 },
}

export function DashboardPage() {
  const theme = useTheme()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [objectId, setObjectId] = useState<number | ''>('')
  const [shareFilter, setShareFilter] = useState<ShareFilter>('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [tagId, setTagId] = useState<number | ''>('')

  const myPersonFilter: ShareFilter | null =
    user?.person_id != null ? `person:${user.person_id}` : null
  const meineRequested = searchParams.get('meine') === '1'
  const myFinancesActive =
    myPersonFilter != null && (shareFilter === myPersonFilter || meineRequested)

  useEffect(() => {
    if (meineRequested && myPersonFilter && shareFilter !== myPersonFilter) {
      setShareFilter(myPersonFilter)
    }
  }, [meineRequested, myPersonFilter, shareFilter])

  function setMyFinances(active: boolean) {
    const next = new URLSearchParams(searchParams)
    if (active && myPersonFilter) {
      next.set('meine', '1')
      setShareFilter(myPersonFilter)
    } else {
      next.delete('meine')
      if (myPersonFilter && shareFilter === myPersonFilter) setShareFilter('')
    }
    setSearchParams(next, { replace: true })
  }

  const filters = useMemo(() => {
    const base = {
      year,
      objectId: objectId === '' ? null : objectId,
      personId: null as number | null,
      partyId: null as number | null,
      household: false,
      categoryId: categoryId === '' ? null : categoryId,
      tagId: tagId === '' ? null : tagId,
    }
    if (shareFilter === 'household') base.household = true
    else if (shareFilter.startsWith('person:')) base.personId = Number(shareFilter.slice(7))
    else if (shareFilter.startsWith('party:')) base.partyId = Number(shareFilter.slice(6))
    return base
  }, [year, objectId, shareFilter, categoryId, tagId])

  const { data: filterOptions } = useQuery({
    queryKey: ['dashboard-filter-options'],
    queryFn: analyticsApi.filterOptions,
  })

  const yearOptions = useMemo(() => {
    const years = new Set(filterOptions?.years || [])
    years.add(currentYear)
    return Array.from(years).sort((a, b) => b - a)
  }, [filterOptions, currentYear])

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['dashboard', filters],
    queryFn: () => analyticsApi.dashboard(filters),
  })

  const hasFilter =
    filters.objectId != null ||
    filters.personId != null ||
    filters.partyId != null ||
    filters.household ||
    filters.categoryId != null ||
    filters.tagId != null

  const filterHint = useMemo(() => {
    const parts: string[] = []
    if (filters.objectId != null) {
      const name = filterOptions?.objects.find((o) => o.id === filters.objectId)?.name
      if (name) parts.push(name)
    }
    if (filters.categoryId != null) {
      const name = filterOptions?.categories.find((c) => c.id === filters.categoryId)?.name
      if (name) parts.push(name)
    }
    if (filters.tagId != null) {
      const name = filterOptions?.tags.find((t) => t.id === filters.tagId)?.name
      if (name) parts.push(`Tag: ${name}`)
    }
    if (filters.household) parts.push('Haushalt')
    if (filters.personId != null) {
      const name = filterOptions?.persons.find((p) => p.id === filters.personId)?.name
      if (name) parts.push(name)
    }
    if (filters.partyId != null) {
      const name = filterOptions?.parties.find((p) => p.id === filters.partyId)?.name
      if (name) parts.push(name)
    }
    return parts.join(' · ')
  }, [filters, filterOptions])

  const pdfFilterLabels = useMemo(() => {
    const objectName =
      filters.objectId != null
        ? filterOptions?.objects.find((o) => o.id === filters.objectId)?.name ?? null
        : null
    const categoryName =
      filters.categoryId != null
        ? filterOptions?.categories.find((c) => c.id === filters.categoryId)?.name ?? null
        : null
    const tagName =
      filters.tagId != null
        ? filterOptions?.tags.find((t) => t.id === filters.tagId)?.name ?? null
        : null
    let shareLabel: string | null = null
    if (filters.household) shareLabel = 'Haushalt'
    else if (filters.personId != null) {
      shareLabel =
        filterOptions?.persons.find((p) => p.id === filters.personId)?.name ?? null
    } else if (filters.partyId != null) {
      shareLabel =
        filterOptions?.parties.find((p) => p.id === filters.partyId)?.name ?? null
    }
    return { objectName, shareLabel, categoryName, tagName }
  }, [filters, filterOptions])

  const [exportingPdf, setExportingPdf] = useState(false)

  async function handleExportPdf() {
    if (!data || exportingPdf) return
    setExportingPdf(true)
    try {
      await exportDashboardPdf(data, {
        ...pdfFilterLabels,
        year: filters.year,
        includePartyComparison: filters.partyId == null && (filterOptions?.parties?.length || 0) > 0,
      })
    } finally {
      setExportingPdf(false)
    }
  }

  if (isLoading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if ((error || !data) && !isFetching) {
    return <Alert severity="error">Dashboard-Daten konnten nicht geladen werden.</Alert>
  }

  if (!data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  const categoryOption = buildPieOption(theme, data.costs_by_category)
  const topBlocksOption = buildBarOption(theme, data.top_cost_blocks, { horizontal: true })
  const partyOption = buildBarOption(theme, data.costs_by_party, { horizontal: false })
  const partyTotal = data.costs_by_party.reduce((sum, row) => sum + Number(row.amount), 0)

  return (
    <Stack spacing={3}>
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
          {year}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
        <FormControl size="small" sx={selectSx}>
          <InputLabel>Jahr</InputLabel>
          <Select
            label="Jahr"
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <MenuItem key={y} value={String(y)}>
                {y}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={selectSx}>
          <InputLabel>Objekt</InputLabel>
          <Select
            label="Objekt"
            value={objectId === '' ? '' : String(objectId)}
            onChange={(e) => {
              const value = e.target.value
              setObjectId(value === '' ? '' : Number(value))
            }}
          >
            <MenuItem value="">Alle</MenuItem>
            {(filterOptions?.objects || []).map((obj) => (
              <MenuItem key={obj.id} value={String(obj.id)}>
                {obj.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={selectSx}>
          <InputLabel>Kategorie</InputLabel>
          <Select
            label="Kategorie"
            value={categoryId === '' ? '' : String(categoryId)}
            onChange={(e) => {
              const value = e.target.value
              setCategoryId(value === '' ? '' : Number(value))
            }}
          >
            <MenuItem value="">Alle</MenuItem>
            {(filterOptions?.categories || []).map((cat) => (
              <MenuItem key={cat.id} value={String(cat.id)}>
                {cat.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={selectSx}>
          <InputLabel>Tag</InputLabel>
          <Select
            label="Tag"
            value={tagId === '' ? '' : String(tagId)}
            onChange={(e) => {
              const value = e.target.value
              setTagId(value === '' ? '' : Number(value))
            }}
          >
            <MenuItem value="">Alle</MenuItem>
            {(filterOptions?.tags || []).map((tag) => (
              <MenuItem key={tag.id} value={String(tag.id)}>
                {tag.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={selectSx}>
          <InputLabel>Anteil</InputLabel>
          <Select
            label="Anteil"
            value={shareFilter}
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
        <MyFinancesButton
          active={myFinancesActive}
          onToggle={() => setMyFinances(!myFinancesActive)}
        />
        {hasFilter && (
          <Button
            size="small"
            onClick={() => {
              setObjectId('')
              setShareFilter('')
              setCategoryId('')
              setTagId('')
              const next = new URLSearchParams(searchParams)
              next.delete('meine')
              setSearchParams(next, { replace: true })
            }}
          >
            Filter zurücksetzen
          </Button>
        )}
        {year !== currentYear && (
          <Button size="small" onClick={() => setYear(currentYear)}>
            Aktuelles Jahr
          </Button>
        )}
        <Button
          size="small"
          variant="outlined"
          startIcon={exportingPdf ? <CircularProgress size={14} /> : <PictureAsPdfIcon />}
          onClick={() => void handleExportPdf()}
          disabled={exportingPdf}
        >
          {exportingPdf ? 'PDF…' : 'PDF'}
        </Button>
        {hasFilter && filterHint && (
          <Typography variant="caption" color="text.secondary">
            {filterHint}
          </Typography>
        )}
        </Box>
      </Box>

      <Stack spacing={2.5}>
        <KpiSection title="Monat">
          <Grid size={{ xs: 12, sm: 4 }}>
            <KpiPanel label="Fixkosten" value={formatCurrency(data.monthly_fixed_costs)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <KpiPanel label="Einnahmen" value={formatCurrency(data.monthly_income)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <KpiPanel label="Netto" value={formatCurrency(data.monthly_net)} />
          </Grid>
        </KpiSection>

        <KpiSection title="Jahr (hochgerechnet)">
          <Grid size={{ xs: 12, sm: 4 }}>
            <KpiPanel label="Ausgaben" value={formatCurrency(data.yearly_fixed_costs)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <KpiPanel label="Einnahmen" value={formatCurrency(data.yearly_income)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <KpiPanel label="Netto" value={formatCurrency(data.yearly_net)} />
          </Grid>
        </KpiSection>

        {(Number(data.one_time_expense) > 0 ||
          Number(data.one_time_income) > 0 ||
          data.active_contracts > 0) && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: { xs: 2, sm: 3 },
              alignItems: 'baseline',
              px: 0.5,
            }}
          >
            {Number(data.one_time_expense) > 0 && (
              <Typography variant="body2" color="text.secondary">
                Einmalig{' '}
                <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                  {formatCurrency(data.one_time_expense)}
                </Box>
              </Typography>
            )}
            {Number(data.one_time_income) > 0 && (
              <Typography variant="body2" color="text.secondary">
                Erstattungen{' '}
                <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                  {formatCurrency(data.one_time_income)}
                </Box>
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              {data.active_contracts} Verträge · {data.active_cost_items} Positionen
              {year === currentYear && data.upcoming_dues.length > 0
                ? ` · ${data.upcoming_dues.length} Fälligkeiten`
                : ''}
            </Typography>
          </Box>
        )}
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
          Diagramme
        </Typography>
        <Button component={RouterLink} to="/analysen" size="small">
          Alle Analysen
        </Button>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Kosten nach Kategorie
              </Typography>
              {data.costs_by_category.length === 0 ? (
                <Typography color="text.secondary">Keine Daten für diesen Filter.</Typography>
              ) : (
                <ReactECharts option={categoryOption} style={{ height: 300 }} notMerge />
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Größte Kostenblöcke
              </Typography>
              {data.top_cost_blocks.length === 0 ? (
                <Typography color="text.secondary">Keine Einträge</Typography>
              ) : (
                <ReactECharts
                  option={topBlocksOption}
                  style={{ height: Math.max(260, data.top_cost_blocks.length * 32 + 40) }}
                  notMerge
                />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {(filterOptions?.parties?.length || 0) > 0 && filters.partyId == null && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Vergleich Parteien
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Gesamt der Partei-Anteile: {formatCurrency(partyTotal)}
              {Number(data.monthly_fixed_costs) > 0 && partyTotal > 0
                ? ` · Dashboard-Gesamt: ${formatCurrency(data.monthly_fixed_costs)}`
                : ''}
            </Typography>
            {data.costs_by_party.length === 0 ? (
              <Typography color="text.secondary">
                Noch keine Kosten auf Parteien verteilt.
              </Typography>
            ) : (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 7 }}>
                  <ReactECharts option={partyOption} style={{ height: 260 }} notMerge />
                </Grid>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Partei</TableCell>
                        <TableCell align="right">Monatlich</TableCell>
                        <TableCell align="right">Anteil</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.costs_by_party.map((row) => (
                        <TableRow key={row.name}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell align="right">{formatCurrency(row.amount)}</TableCell>
                          <TableCell align="right">
                            {partyTotal > 0
                              ? `${((Number(row.amount) / partyTotal) * 100).toFixed(0)} %`
                              : '–'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Fälligkeiten
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Fälligkeit</TableCell>
                <TableCell>Intervall</TableCell>
                <TableCell align="right">Monatsäquivalent</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.upcoming_dues.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>Keine Fälligkeiten hinterlegt</TableCell>
                </TableRow>
              )}
              {data.upcoming_dues.map((due) => (
                <TableRow key={due.cost_item_id}>
                  <TableCell>{due.name}</TableCell>
                  <TableCell>{due.due_label || '–'}</TableCell>
                  <TableCell>{INTERVAL_LABELS[due.payment_interval]}</TableCell>
                  <TableCell align="right">{formatCurrency(due.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  )
}

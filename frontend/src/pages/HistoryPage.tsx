import { useEffect, useMemo, useState } from 'react'
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
import ReactECharts from 'echarts-for-react'
import { useSearchParams } from 'react-router-dom'
import { analyticsApi } from '../api'
import { formatCurrency } from '../utils/format'
import { MyFinancesButton } from '../components/MyFinancesButton'
import { useAuth } from '../auth/AuthContext'

type ShareFilter = '' | 'household' | `person:${number}` | `party:${number}`

const selectSx = {
  minWidth: 140,
  maxWidth: 180,
  '& .MuiInputBase-root': { fontSize: 13 },
  '& .MuiInputLabel-root': { fontSize: 13 },
}

const EVENT_LABELS: Record<string, string> = {
  created: 'Hinzugefügt',
  changed: 'Angepasst',
  ended: 'Entfernt',
  reactivated: 'Reaktiviert',
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        <Typography variant="h5">{value}</Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

export function HistoryPage() {
  const theme = useTheme()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [objectId, setObjectId] = useState<number | ''>('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [tagId, setTagId] = useState<number | ''>('')
  const [shareFilter, setShareFilter] = useState<ShareFilter>('')
  const [monthsBack, setMonthsBack] = useState(12)
  const [forecastMonths, setForecastMonths] = useState(6)

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
      objectId: objectId === '' ? null : objectId,
      categoryId: categoryId === '' ? null : categoryId,
      tagId: tagId === '' ? null : tagId,
      personId: null as number | null,
      partyId: null as number | null,
      household: false,
      monthsBack,
      forecastMonths,
    }
    if (shareFilter === 'household') base.household = true
    else if (shareFilter.startsWith('person:')) base.personId = Number(shareFilter.slice(7))
    else if (shareFilter.startsWith('party:')) base.partyId = Number(shareFilter.slice(6))
    return base
  }, [objectId, categoryId, tagId, shareFilter, monthsBack, forecastMonths])

  const { data: filterOptions } = useQuery({
    queryKey: ['dashboard-filter-options'],
    queryFn: analyticsApi.filterOptions,
  })

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['cost-history', filters],
    queryFn: () => analyticsApi.costHistory(filters),
  })

  const hasFilter =
    filters.objectId != null ||
    filters.categoryId != null ||
    filters.tagId != null ||
    filters.personId != null ||
    filters.partyId != null ||
    filters.household

  const chartOption = useMemo(() => {
    if (!data) return null
    const actual = data.series.filter((p) => !p.is_forecast)
    const forecast = data.series.filter((p) => p.is_forecast)
    const months = data.series.map((p) => p.month)
    const actualSeries = data.series.map((p) =>
      p.is_forecast ? null : Number(p.monthly_total),
    )
    const forecastSeries = data.series.map((p, idx) => {
      if (p.is_forecast) return Number(p.monthly_total)
      // Connect forecast line to last actual point
      if (forecast.length && idx === actual.length - 1) return Number(p.monthly_total)
      return null
    })

    return {
      color: [theme.palette.primary.main, theme.palette.secondary.main],
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: number | null) =>
          value == null ? '–' : formatCurrency(value),
      },
      legend: {
        data: ['Ist', 'Prognose'],
        bottom: 0,
        textStyle: { color: theme.palette.text.secondary },
      },
      grid: { left: 56, right: 24, top: 24, bottom: 48 },
      xAxis: {
        type: 'category',
        data: months,
        boundaryGap: false,
        axisLabel: { color: theme.palette.text.secondary, fontSize: 11 },
        axisLine: { lineStyle: { color: theme.palette.divider } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: theme.palette.text.secondary,
          formatter: (v: number) => `${Math.round(v)} €`,
        },
        splitLine: { lineStyle: { color: theme.palette.divider } },
      },
      series: [
        {
          name: 'Ist',
          type: 'line',
          data: actualSeries,
          smooth: 0.2,
          showSymbol: actual.length <= 18,
          symbolSize: 6,
          lineStyle: { width: 2.5 },
          areaStyle: {
            color: theme.palette.mode === 'dark' ? 'rgba(107,155,210,0.18)' : 'rgba(47,93,140,0.12)',
          },
        },
        {
          name: 'Prognose',
          type: 'line',
          data: forecastSeries,
          smooth: 0.2,
          showSymbol: false,
          lineStyle: { width: 2, type: 'dashed' },
        },
      ],
    }
  }, [data, theme])

  if (isLoading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if ((error || !data) && !isFetching) {
    return <Alert severity="error">Kostenhistorie konnte nicht geladen werden.</Alert>
  }

  if (!data || !chartOption) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  const change = Number(data.summary.change_monthly)
  const changeHint =
    change > 0 ? 'steigend' : change < 0 ? 'sinkend' : 'unverändert'

  return (
    <Stack spacing={3}>
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
          <InputLabel>Zeitraum</InputLabel>
          <Select
            label="Zeitraum"
            value={String(monthsBack)}
            onChange={(e) => setMonthsBack(Number(e.target.value))}
          >
            <MenuItem value="6">6 Monate</MenuItem>
            <MenuItem value="12">12 Monate</MenuItem>
            <MenuItem value="24">24 Monate</MenuItem>
            <MenuItem value="36">36 Monate</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={selectSx}>
          <InputLabel>Prognose</InputLabel>
          <Select
            label="Prognose"
            value={String(forecastMonths)}
            onChange={(e) => setForecastMonths(Number(e.target.value))}
          >
            <MenuItem value="0">Keine</MenuItem>
            <MenuItem value="3">3 Monate</MenuItem>
            <MenuItem value="6">6 Monate</MenuItem>
            <MenuItem value="12">12 Monate</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={selectSx}>
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
        <FormControl size="small" sx={selectSx}>
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
        <FormControl size="small" sx={selectSx}>
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
              setCategoryId('')
              setTagId('')
              setShareFilter('')
              const next = new URLSearchParams(searchParams)
              next.delete('meine')
              setSearchParams(next, { replace: true })
            }}
          >
            Zurücksetzen
          </Button>
        )}
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Kpi
            label="Aktuell monatlich (Netto)"
            value={formatCurrency(data.summary.current_monthly)}
            hint={`${data.summary.active_items} aktive Positionen`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Kpi
            label="Zu Periodenbeginn"
            value={formatCurrency(data.summary.start_monthly)}
            hint={`${data.summary.months_back} Monate zurück`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Kpi
            label="Veränderung"
            value={formatCurrency(data.summary.change_monthly)}
            hint={`${Number(data.summary.change_percent)} % · ${changeHint}`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Kpi
            label="Prognose-Horizont"
            value={`${data.summary.forecast_months} Mon.`}
            hint="lineare Trendfortschreibung"
          />
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Monatliche Netto-Belastung im Verlauf
          </Typography>
          <ReactECharts option={chartOption} style={{ height: 380 }} notMerge />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Änderungen
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Neue, angepasste und entfernte Kostenpositionen im gewählten Zeitraum.
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Datum</TableCell>
                <TableCell>Ereignis</TableCell>
                <TableCell>Position</TableCell>
                <TableCell align="right">Betrag</TableCell>
                <TableCell align="right">Monatsäquivalent</TableCell>
                <TableCell>Hinweis</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>Keine Ereignisse im Zeitraum</TableCell>
                </TableRow>
              )}
              {data.events.map((event) => (
                <TableRow key={`${event.cost_item_id}-${event.date}-${event.event_type}-${event.notes}`}>
                  <TableCell>{event.date}</TableCell>
                  <TableCell>{EVENT_LABELS[event.event_type] || event.event_type}</TableCell>
                  <TableCell>{event.cost_item_name}</TableCell>
                  <TableCell align="right">{formatCurrency(event.amount)}</TableCell>
                  <TableCell align="right">{formatCurrency(event.monthly_amount)}</TableCell>
                  <TableCell>{event.notes || '–'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  )
}

import { useMemo, useState } from 'react'
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
import { analyticsApi } from '../api'
import { formatCurrency } from '../utils/format'
import { exportDashboardPdf } from '../utils/exportDashboardPdf'
import { INTERVAL_LABELS } from '../api/types'

function KpiPanel({ label, value, hint }: { label: string; value: string; hint?: string }) {
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

type ShareFilter = '' | 'household' | `person:${number}` | `party:${number}`

const selectSx = {
  minWidth: 140,
  maxWidth: 180,
  '& .MuiInputBase-root': { fontSize: 13 },
  '& .MuiInputLabel-root': { fontSize: 13 },
}

export function DashboardPage() {
  const theme = useTheme()
  const [objectId, setObjectId] = useState<number | ''>('')
  const [shareFilter, setShareFilter] = useState<ShareFilter>('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [tagId, setTagId] = useState<number | ''>('')

  const filters = useMemo(() => {
    const base = {
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
  }, [objectId, shareFilter, categoryId, tagId])

  const { data: filterOptions } = useQuery({
    queryKey: ['dashboard-filter-options'],
    queryFn: analyticsApi.filterOptions,
  })

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

  function handleExportPdf() {
    exportDashboardPdf(data!, {
      ...pdfFilterLabels,
      includePartyComparison: filters.partyId == null && (filterOptions?.parties?.length || 0) > 0,
    })
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

  const textColor = theme.palette.text.primary
  const muted = theme.palette.text.secondary

  const categoryOption = {
    color: ['#2F5D8C', '#5B8FB9', '#7AA2C4', '#9BB5C9', '#B8C9D6', '#D4DEE6'],
    tooltip: { trigger: 'item', formatter: '{b}: {c} € ({d}%)' },
    legend: { bottom: 0, textStyle: { color: muted } },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 2, borderColor: theme.palette.background.paper, borderWidth: 2 },
        label: { color: textColor },
        data: data.costs_by_category.map((c) => ({
          name: c.name,
          value: Number(c.amount),
        })),
      },
    ],
  }

  const personOption = {
    color: ['#2F5D8C'],
    grid: { left: 40, right: 20, top: 20, bottom: 40 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: data.costs_by_person.map((p) => p.name),
      axisLabel: { color: muted },
      axisLine: { lineStyle: { color: theme.palette.divider } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: theme.palette.divider } },
    },
    series: [
      {
        type: 'bar',
        data: data.costs_by_person.map((p) => Number(p.amount)),
        barMaxWidth: 36,
        itemStyle: { borderRadius: [3, 3, 0, 0] },
      },
    ],
  }

  const partyOption = {
    color: ['#5B8FB9'],
    grid: { left: 40, right: 20, top: 20, bottom: 40 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: data.costs_by_party.map((p) => p.name),
      axisLabel: { color: muted },
      axisLine: { lineStyle: { color: theme.palette.divider } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: theme.palette.divider } },
    },
    series: [
      {
        type: 'bar',
        data: data.costs_by_party.map((p) => Number(p.amount)),
        barMaxWidth: 36,
        itemStyle: { borderRadius: [3, 3, 0, 0] },
      },
    ],
  }

  const partyTotal = data.costs_by_party.reduce((sum, row) => sum + Number(row.amount), 0)

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
        {hasFilter && (
          <Button
            size="small"
            onClick={() => {
              setObjectId('')
              setShareFilter('')
              setCategoryId('')
              setTagId('')
            }}
          >
            Zurücksetzen
          </Button>
        )}
        <Button
          size="small"
          variant="outlined"
          startIcon={<PictureAsPdfIcon />}
          onClick={handleExportPdf}
        >
          PDF
        </Button>
        {hasFilter && (
          <Typography variant="caption" color="text.secondary">
            {filterHint}
          </Typography>
        )}
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiPanel label="Monatliche Fixkosten" value={formatCurrency(data.monthly_fixed_costs)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiPanel label="Jährliche Fixkosten" value={formatCurrency(data.yearly_fixed_costs)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiPanel
            label="Aktive Verträge"
            value={String(data.active_contracts)}
            hint={`${data.active_cost_items} Kostenpositionen`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiPanel
            label="Nächste Fälligkeiten"
            value={String(data.upcoming_dues.length)}
            hint="mit Fälligkeitstag"
          />
        </Grid>
      </Grid>

      {(filterOptions?.parties?.length || 0) > 0 && filters.partyId == null && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Vergleich Parteien
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enthält direkte Partei-Kosten sowie Anteile zugeordneter Personen und Objekte.
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
                <Grid size={{ xs: 12, md: 6 }}>
                  <ReactECharts option={partyOption} style={{ height: 260 }} notMerge />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
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
                      <TableRow>
                        <TableCell>
                          <strong>Gesamt Parteien</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>{formatCurrency(partyTotal)}</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>100 %</strong>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Kosten nach Kategorie
              </Typography>
              {data.costs_by_category.length === 0 ? (
                <Typography color="text.secondary">Keine Daten für diesen Filter.</Typography>
              ) : (
                <ReactECharts option={categoryOption} style={{ height: 320 }} notMerge />
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Kosten je Person / Haushalt
              </Typography>
              {data.costs_by_person.length === 0 ? (
                <Typography color="text.secondary">Keine Daten für diesen Filter.</Typography>
              ) : (
                <ReactECharts option={personOption} style={{ height: 320 }} notMerge />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Größte Kostenblöcke (monatlich)
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Position</TableCell>
                    <TableCell align="right">Betrag</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.top_cost_blocks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2}>Keine Einträge</TableCell>
                    </TableRow>
                  )}
                  {data.top_cost_blocks.map((row) => (
                    <TableRow key={`${row.id}-${row.name}`}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align="right">{formatCurrency(row.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Kosten je Objekt
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Objekt</TableCell>
                    <TableCell align="right">Monatlich</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.costs_by_object.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2}>Keine Einträge</TableCell>
                    </TableRow>
                  )}
                  {data.costs_by_object.map((row) => (
                    <TableRow key={`${row.id}-${row.name}`}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align="right">{formatCurrency(row.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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

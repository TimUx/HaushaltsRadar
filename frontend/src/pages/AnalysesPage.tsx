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
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material'
import ReactECharts from 'echarts-for-react'
import { useSearchParams } from 'react-router-dom'
import { analyticsApi, type BreakdownGroupBy } from '../api'
import { MyFinancesButton } from '../components/MyFinancesButton'
import { useAuth } from '../auth/AuthContext'
import { formatCurrency } from '../utils/format'
import {
  buildBarOption,
  buildHeatmapOption,
  buildLineOption,
  buildPieOption,
  buildSankeyOption,
  buildSunburstOption,
  buildTreemapOption,
} from '../charts'

type ShareFilter = '' | 'household' | `person:${number}` | `party:${number}`
type ChartType = 'verteilung' | 'vergleich' | 'verlauf' | 'hierarchie' | 'heatmap' | 'fluss'
type HierarchyView = 'treemap' | 'sunburst'

const selectSx = {
  minWidth: 140,
  maxWidth: 180,
  '& .MuiInputBase-root': { fontSize: 13 },
  '& .MuiInputLabel-root': { fontSize: 13 },
}

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: 'verteilung', label: 'Verteilung' },
  { id: 'vergleich', label: 'Vergleich' },
  { id: 'verlauf', label: 'Verlauf' },
  { id: 'hierarchie', label: 'Hierarchie' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'fluss', label: 'Fluss' },
]

const GROUP_OPTIONS: { id: BreakdownGroupBy; label: string }[] = [
  { id: 'category', label: 'Kategorie' },
  { id: 'person', label: 'Person' },
  { id: 'object', label: 'Objekt' },
  { id: 'tag', label: 'Tag' },
  { id: 'party', label: 'Partei' },
]

export function AnalysesPage() {
  const theme = useTheme()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [objectId, setObjectId] = useState<number | ''>('')
  const [shareFilter, setShareFilter] = useState<ShareFilter>('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [tagId, setTagId] = useState<number | ''>('')
  const [chartType, setChartType] = useState<ChartType>('verteilung')
  const [groupBy, setGroupBy] = useState<BreakdownGroupBy>('category')
  const [hierarchyMode, setHierarchyMode] = useState<'category' | 'structure'>('category')
  const [hierarchyView, setHierarchyView] = useState<HierarchyView>('treemap')

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

  const needsBreakdown = chartType === 'verteilung' || chartType === 'vergleich'
  const breakdownQuery = useQuery({
    queryKey: ['chart-breakdown', groupBy, filters],
    queryFn: () => analyticsApi.breakdown(groupBy, filters),
    enabled: needsBreakdown,
  })
  const historyQuery = useQuery({
    queryKey: ['chart-history', filters],
    queryFn: () =>
      analyticsApi.costHistory({
        ...filters,
        monthsBack: 18,
        forecastMonths: 6,
      }),
    enabled: chartType === 'verlauf',
  })
  const hierarchyQuery = useQuery({
    queryKey: ['chart-hierarchy', hierarchyMode, filters],
    queryFn: () => analyticsApi.hierarchy(hierarchyMode, filters),
    enabled: chartType === 'hierarchie',
  })
  const heatmapQuery = useQuery({
    queryKey: ['chart-heatmap', filters],
    queryFn: () => analyticsApi.heatmap(filters),
    enabled: chartType === 'heatmap',
  })
  const flowQuery = useQuery({
    queryKey: ['chart-flow', filters],
    queryFn: () => analyticsApi.flow(filters),
    enabled: chartType === 'fluss',
  })

  const activeQuery =
    chartType === 'verlauf'
      ? historyQuery
      : chartType === 'hierarchie'
        ? hierarchyQuery
        : chartType === 'heatmap'
          ? heatmapQuery
          : chartType === 'fluss'
            ? flowQuery
            : breakdownQuery

  const chartOption = useMemo(() => {
    if (needsBreakdown && breakdownQuery.data) {
      const items = breakdownQuery.data.items
      return chartType === 'verteilung'
        ? buildPieOption(theme, items)
        : buildBarOption(theme, items, { horizontal: true })
    }
    if (chartType === 'verlauf' && historyQuery.data) {
      return buildLineOption(theme, historyQuery.data.series)
    }
    if (chartType === 'hierarchie' && hierarchyQuery.data) {
      return hierarchyView === 'treemap'
        ? buildTreemapOption(theme, hierarchyQuery.data.nodes)
        : buildSunburstOption(theme, hierarchyQuery.data.nodes)
    }
    if (chartType === 'heatmap' && heatmapQuery.data) {
      return buildHeatmapOption(
        theme,
        heatmapQuery.data.categories,
        heatmapQuery.data.months,
        heatmapQuery.data.values,
      )
    }
    if (chartType === 'fluss' && flowQuery.data) {
      return buildSankeyOption(theme, flowQuery.data.nodes, flowQuery.data.links)
    }
    return null
  }, [
    needsBreakdown,
    breakdownQuery.data,
    chartType,
    theme,
    historyQuery.data,
    hierarchyQuery.data,
    hierarchyView,
    heatmapQuery.data,
    flowQuery.data,
  ])

  const chartHeight =
    chartType === 'heatmap' ? Math.max(360, (heatmapQuery.data?.categories.length || 4) * 28 + 100) : 420

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
          Analysen
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
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
          {(objectId !== '' ||
            categoryId !== '' ||
            tagId !== '' ||
            shareFilter !== '' ||
            myFinancesActive) && (
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
      </Box>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={chartType}
        onChange={(_, value: ChartType | null) => {
          if (value) setChartType(value)
        }}
        sx={{ flexWrap: 'wrap' }}
      >
        {CHART_TYPES.map((t) => (
          <ToggleButton key={t.id} value={t.id}>
            {t.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        {needsBreakdown && (
          <FormControl size="small" sx={selectSx}>
            <InputLabel>Dimension</InputLabel>
            <Select
              label="Dimension"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as BreakdownGroupBy)}
            >
              {GROUP_OPTIONS.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {chartType === 'hierarchie' && (
          <>
            <FormControl size="small" sx={selectSx}>
              <InputLabel>Modus</InputLabel>
              <Select
                label="Modus"
                value={hierarchyMode}
                onChange={(e) =>
                  setHierarchyMode(e.target.value as 'category' | 'structure')
                }
              >
                <MenuItem value="category">Kategorie → Posten</MenuItem>
                <MenuItem value="structure">Partei → Person → Objekt</MenuItem>
              </Select>
            </FormControl>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={hierarchyView}
              onChange={(_, value: HierarchyView | null) => {
                if (value) setHierarchyView(value)
              }}
            >
              <ToggleButton value="treemap">Treemap</ToggleButton>
              <ToggleButton value="sunburst">Sunburst</ToggleButton>
            </ToggleButtonGroup>
          </>
        )}
      </Box>

      <Card>
        <CardContent>
          {activeQuery.isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={28} />
            </Box>
          )}
          {activeQuery.error && (
            <Alert severity="error">Diagrammdaten konnten nicht geladen werden.</Alert>
          )}
          {!activeQuery.isLoading && !activeQuery.error && chartOption && (
            <ReactECharts
              option={chartOption}
              style={{ height: chartHeight, width: '100%' }}
              notMerge
            />
          )}
          {!activeQuery.isLoading && !activeQuery.error && !chartOption && (
            <Typography color="text.secondary">Keine Daten für diesen Filter.</Typography>
          )}
        </CardContent>
      </Card>

      {needsBreakdown && breakdownQuery.data && breakdownQuery.data.items.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Daten
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell align="right">Monatlich</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {breakdownQuery.data.items.map((row) => (
                  <TableRow key={`${row.id}-${row.name}`}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell align="right">{formatCurrency(row.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Stack>
  )
}

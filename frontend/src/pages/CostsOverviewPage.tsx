import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DataGrid, type GridColDef, type GridColumnVisibilityModel } from '@mui/x-data-grid'
import { deDE } from '@mui/x-data-grid/locales'
import { useSearchParams } from 'react-router-dom'
import { analyticsApi } from '../api'
import type { CostOverviewRow } from '../api/types'
import { formatCurrency } from '../utils/format'
import { MyFinancesButton } from '../components/MyFinancesButton'
import { useAuth } from '../auth/AuthContext'
import { overviewRowBelongsToPerson } from '../utils/myFinances'
import { filterBarSx, filterControlSx } from '../theme/responsiveSx'

function moneyValue(value: string | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'string' ? Number(value) : value
}

const MOBILE_HIDDEN_COLUMNS = [
  'object_party',
  'object_person',
  'allocations',
  'contract_partner',
  'contract_provider',
  'contract_number',
  'contract_notice_days',
  'contract_auto_renewal',
  'contract_start',
  'contract_end',
  'start_date',
  'end_date',
  'description',
  'notes',
  'currency',
  'tags',
  'yearly_amount',
] as const

function mobileVisibilityModel(): GridColumnVisibilityModel {
  return Object.fromEntries(MOBILE_HIDDEN_COLUMNS.map((field) => [field, false]))
}

export function CostsOverviewPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [tagId, setTagId] = useState<number | ''>('')
  const [entryType, setEntryType] = useState<'' | 'expense' | 'income'>('')
  const [columnVisibilityModel, setColumnVisibilityModel] = useState<GridColumnVisibilityModel>({})

  const myFinances = searchParams.get('meine') === '1' && user?.person_id != null

  function setMyFinances(active: boolean) {
    const next = new URLSearchParams(searchParams)
    if (active) next.set('meine', '1')
    else next.delete('meine')
    setSearchParams(next, { replace: true })
  }

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['cost-overview'],
    queryFn: analyticsApi.costOverview,
  })
  const { data: filterOptions } = useQuery({
    queryKey: ['dashboard-filter-options'],
    queryFn: analyticsApi.filterOptions,
  })

  const filteredRows = useMemo(() => {
    return data.filter((row) => {
      if (categoryId !== '' && row.category_id !== categoryId) return false
      if (tagId !== '' && !(row.tag_ids || []).includes(tagId)) return false
      if (entryType !== '' && row.entry_type !== entryType) return false
      if (myFinances && user?.person_id != null && !overviewRowBelongsToPerson(row, user.person_id)) {
        return false
      }
      return true
    })
  }, [data, categoryId, tagId, entryType, myFinances, user?.person_id])

  const hasFilter = categoryId !== '' || tagId !== '' || entryType !== '' || myFinances

  const effectiveVisibility = useMemo(() => {
    if (!isMobile) return columnVisibilityModel
    return { ...mobileVisibilityModel(), ...columnVisibilityModel }
  }, [isMobile, columnVisibilityModel])

  const columns = useMemo<GridColDef<CostOverviewRow>[]>(
    () => [
      { field: 'name', headerName: 'Posten', flex: 1.2, minWidth: isMobile ? 140 : 160 },
      { field: 'entry_type_label', headerName: 'Art', width: isMobile ? 100 : 110 },
      { field: 'category', headerName: 'Kategorie', flex: 0.8, minWidth: 120 },
      { field: 'tags', headerName: 'Tags', flex: 1, minWidth: 140 },
      { field: 'object', headerName: 'Objekt', flex: 0.8, minWidth: 120 },
      { field: 'object_party', headerName: 'Objekt-Partei', flex: 0.7, minWidth: 110 },
      { field: 'object_person', headerName: 'Objekt-Person', flex: 0.7, minWidth: 110 },
      { field: 'allocations', headerName: 'Verteilung', flex: 1.2, minWidth: 180 },
      {
        field: 'amount',
        headerName: 'Betrag',
        type: 'number',
        width: 110,
        valueGetter: (_value, row) => moneyValue(row.amount),
        valueFormatter: (value: number) => formatCurrency(value ?? 0),
      },
      { field: 'payment_interval_label', headerName: 'Intervall', width: 130 },
      {
        field: 'monthly_amount',
        headerName: 'Monatlich',
        type: 'number',
        width: 110,
        valueGetter: (_value, row) => moneyValue(row.monthly_amount),
        valueFormatter: (value: number) => formatCurrency(value ?? 0),
      },
      {
        field: 'yearly_amount',
        headerName: 'Jährlich',
        type: 'number',
        width: 110,
        valueGetter: (_value, row) => moneyValue(row.yearly_amount),
        valueFormatter: (value: number) => formatCurrency(value ?? 0),
      },
      { field: 'due_label', headerName: 'Fälligkeit', width: 120 },
      { field: 'contract_partner', headerName: 'Vertragspartner', flex: 0.9, minWidth: 130 },
      { field: 'contract_provider', headerName: 'Vertrag Anbieter', flex: 0.9, minWidth: 130 },
      { field: 'contract_number', headerName: 'Vertragsnr.', width: 120 },
      {
        field: 'contract_notice_days',
        headerName: 'Kündigungsfrist',
        type: 'number',
        width: 130,
        valueFormatter: (value: number | null) => (value == null ? '–' : `${value} Tage`),
      },
      {
        field: 'contract_auto_renewal',
        headerName: 'Auto-Verlängerung',
        width: 130,
        valueFormatter: (value: boolean | null) =>
          value == null ? '–' : value ? 'Ja' : 'Nein',
      },
      { field: 'contract_start', headerName: 'Vertrag Start', width: 120 },
      { field: 'contract_end', headerName: 'Vertrag Ende', width: 120 },
      { field: 'start_date', headerName: 'Posten Start', width: 120 },
      { field: 'end_date', headerName: 'Posten Ende', width: 120 },
      { field: 'description', headerName: 'Beschreibung', flex: 1, minWidth: 140 },
      { field: 'notes', headerName: 'Notizen', flex: 1, minWidth: 140 },
      { field: 'currency', headerName: 'Währung', width: 90 },
    ],
    [isMobile],
  )

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if (error) {
    return <Alert severity="error">Kostenübersicht konnte nicht geladen werden.</Alert>
  }

  return (
    <Stack spacing={1.5} sx={{ height: { xs: 'calc(100dvh - 120px)', md: 'calc(100vh - 140px)' } }}>
      <Box sx={{ ...filterBarSx, justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
        <FormControl size="small" sx={filterControlSx}>
          <InputLabel>Art</InputLabel>
          <Select
            label="Art"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as '' | 'expense' | 'income')}
          >
            <MenuItem value="">Alle</MenuItem>
            <MenuItem value="expense">Ausgabe</MenuItem>
            <MenuItem value="income">Einnahme</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={filterControlSx}>
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
        <FormControl size="small" sx={filterControlSx}>
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
        <MyFinancesButton active={myFinances} onToggle={() => setMyFinances(!myFinances)} />
        {hasFilter && (
          <Button
            size="small"
            onClick={() => {
              setCategoryId('')
              setTagId('')
              setEntryType('')
              setMyFinances(false)
            }}
          >
            Zurücksetzen
          </Button>
        )}
      </Box>
      <Card sx={{ flex: 1, minHeight: 0, p: { xs: 0.5, sm: 1 } }}>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          columnVisibilityModel={effectiveVisibility}
          onColumnVisibilityModelChange={setColumnVisibilityModel}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: isMobile ? 25 : 50, page: 0 } },
            sorting: { sortModel: [{ field: 'name', sort: 'asc' }] },
          }}
          filterMode="client"
          sortingMode="client"
          showToolbar
          slotProps={{
            toolbar: {
              showQuickFilter: true,
            },
          }}
          localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
          density={isMobile ? 'standard' : 'compact'}
          sx={{
            border: 'none',
            height: '100%',
            '& .MuiDataGrid-columnHeader': {
              backgroundColor: 'background.default',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 600,
              fontSize: { xs: 13, sm: 12 },
            },
            '& .MuiDataGrid-cell': {
              fontSize: { xs: 14, sm: 13 },
            },
          }}
        />
      </Card>
    </Stack>
  )
}

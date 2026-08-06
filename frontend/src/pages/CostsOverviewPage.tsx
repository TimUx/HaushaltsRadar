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
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { deDE } from '@mui/x-data-grid/locales'
import { analyticsApi } from '../api'
import type { CostOverviewRow } from '../api/types'
import { formatCurrency } from '../utils/format'

function moneyValue(value: string | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'string' ? Number(value) : value
}

export function CostsOverviewPage() {
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [tagId, setTagId] = useState<number | ''>('')

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
      return true
    })
  }, [data, categoryId, tagId])

  const hasFilter = categoryId !== '' || tagId !== ''

  const columns = useMemo<GridColDef<CostOverviewRow>[]>(
    () => [
      { field: 'name', headerName: 'Kostenposition', flex: 1.2, minWidth: 160 },
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
      { field: 'start_date', headerName: 'Kosten Start', width: 120 },
      { field: 'end_date', headerName: 'Kosten Ende', width: 120 },
      { field: 'description', headerName: 'Beschreibung', flex: 1, minWidth: 140 },
      { field: 'notes', headerName: 'Notizen', flex: 1, minWidth: 140 },
      { field: 'currency', headerName: 'Währung', width: 90 },
    ],
    [],
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
    <Stack spacing={1.5} sx={{ height: { xs: 600, md: 'calc(100vh - 140px)' } }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end' }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
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
        <FormControl size="small" sx={{ minWidth: 150 }}>
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
        {hasFilter && (
          <Button
            size="small"
            onClick={() => {
              setCategoryId('')
              setTagId('')
            }}
          >
            Zurücksetzen
          </Button>
        )}
      </Box>
      <Card sx={{ flex: 1, minHeight: 0, p: 1 }}>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 50, page: 0 } },
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
          density="compact"
          sx={{
            border: 'none',
            height: '100%',
            '& .MuiDataGrid-columnHeader': {
              backgroundColor: 'background.default',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 600,
              fontSize: 12,
            },
            '& .MuiDataGrid-cell': {
              fontSize: 13,
            },
          }}
        />
      </Card>
    </Stack>
  )
}

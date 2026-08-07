import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import AddIcon from '@mui/icons-material/Add'
import type { Party, Person } from '../api/types'
import { createId } from '../utils/id'

export type AllocationDraft = {
  key: string
  is_household: boolean
  person_id: number | ''
  party_id: number | ''
  percentage: string
}

export function emptyAllocation(isHousehold = false): AllocationDraft {
  return {
    key: createId(),
    is_household: isHousehold,
    person_id: '',
    party_id: '',
    percentage: isHousehold ? '100' : '0',
  }
}

export function draftsFromAllocations(
  allocations: Array<{
    is_household: boolean
    person_id?: number | null
    party_id?: number | null
    percentage: string | number
  }>,
): AllocationDraft[] {
  if (!allocations.length) return [emptyAllocation(true)]
  return allocations.map((a) => ({
    key: createId(),
    is_household: a.is_household,
    person_id: a.person_id ?? '',
    party_id: a.party_id ?? '',
    percentage: String(a.percentage),
  }))
}

export function allocationsPayload(drafts: AllocationDraft[]) {
  return drafts.map((d) => ({
    is_household: d.is_household,
    person_id: d.is_household || d.party_id !== '' ? null : Number(d.person_id),
    party_id: d.is_household || d.person_id !== '' ? null : Number(d.party_id),
    percentage: Number(d.percentage),
  }))
}

export function allocationTotal(drafts: AllocationDraft[]): number {
  return drafts.reduce((sum, d) => sum + (Number(d.percentage) || 0), 0)
}

function rowSelectValue(row: AllocationDraft): string {
  if (row.is_household) return 'household'
  if (row.party_id !== '') return `party:${row.party_id}`
  if (row.person_id !== '') return `person:${row.person_id}`
  return ''
}

interface AllocationEditorProps {
  persons: Person[]
  parties: Party[]
  value: AllocationDraft[]
  onChange: (next: AllocationDraft[]) => void
}

export function AllocationEditor({ persons, parties, value, onChange }: AllocationEditorProps) {
  const total = allocationTotal(value)

  function updateRow(key: string, patch: Partial<AllocationDraft>) {
    onChange(value.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function removeRow(key: string) {
    onChange(value.length <= 1 ? value : value.filter((row) => row.key !== key))
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Kostenverteilung</Typography>
      <Typography variant="caption" color="text.secondary">
        Summe 100 %. Zuweisung an Haushalt, Partei oder Person. Personen-Anteile fließen
        automatisch in die Partei der Person.
      </Typography>
      {value.map((row) => (
        <Box key={row.key} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <FormControl fullWidth size="small">
            <InputLabel>Zuweisung</InputLabel>
            <Select
              label="Zuweisung"
              value={rowSelectValue(row)}
              onChange={(e) => {
                const selected = e.target.value
                if (selected === 'household') {
                  updateRow(row.key, { is_household: true, person_id: '', party_id: '' })
                } else if (selected.startsWith('party:')) {
                  updateRow(row.key, {
                    is_household: false,
                    person_id: '',
                    party_id: Number(selected.replace('party:', '')),
                  })
                } else if (selected.startsWith('person:')) {
                  updateRow(row.key, {
                    is_household: false,
                    party_id: '',
                    person_id: Number(selected.replace('person:', '')),
                  })
                }
              }}
            >
              <MenuItem value="household">Haushalt (gesamt)</MenuItem>
              {parties.map((party) => (
                <MenuItem key={`party-${party.id}`} value={`party:${party.id}`}>
                  Partei: {party.name}
                </MenuItem>
              ))}
              {persons.map((person) => (
                <MenuItem key={`person-${person.id}`} value={`person:${person.id}`}>
                  Person: {person.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="%"
            type="number"
            size="small"
            value={row.percentage}
            onChange={(e) => updateRow(row.key, { percentage: e.target.value })}
            sx={{ width: 110 }}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 0.01 } }}
          />
          <IconButton aria-label="Zeile entfernen" onClick={() => removeRow(row.key)} size="small">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          startIcon={<AddIcon />}
          size="small"
          onClick={() => onChange([...value, emptyAllocation(false)])}
        >
          Anteil hinzufügen
        </Button>
        <Typography
          variant="body2"
          color={Math.abs(total - 100) < 0.001 ? 'text.secondary' : 'error'}
        >
          Summe: {total.toFixed(2)} %
        </Typography>
      </Box>
    </Stack>
  )
}

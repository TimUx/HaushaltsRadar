import type { Theme } from '@mui/material/styles'

export const CHART_PALETTE = [
  '#2F5D8C',
  '#5B8FB9',
  '#7AA2C4',
  '#9BB5C9',
  '#B8C9D6',
  '#D4DEE6',
  '#3D7A5A',
  '#C47B4A',
]

export function chartTheme(theme: Theme) {
  return {
    textColor: theme.palette.text.primary,
    muted: theme.palette.text.secondary,
    divider: theme.palette.divider,
    paper: theme.palette.background.paper,
    palette: CHART_PALETTE,
  }
}

export type NamedChartItem = {
  id?: number | null
  name: string
  amount: string | number
}

export function toNumber(value: string | number): number {
  return typeof value === 'string' ? Number(value) : value
}

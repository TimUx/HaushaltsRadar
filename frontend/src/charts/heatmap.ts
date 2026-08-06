import type { Theme } from '@mui/material/styles'
import { chartTheme } from './theme'

export function buildHeatmapOption(
  theme: Theme,
  categories: string[],
  months: string[],
  values: number[][],
) {
  const t = chartTheme(theme)
  const data: [number, number, number][] = []
  let max = 0
  values.forEach((row, y) => {
    row.forEach((v, x) => {
      data.push([x, y, v])
      if (v > max) max = v
    })
  })

  return {
    tooltip: {
      position: 'top',
      formatter: (p: { value: [number, number, number] }) => {
        const [x, y, v] = p.value
        return `${categories[y]} · ${months[x]}: ${v.toLocaleString('de-DE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} €`
      },
    },
    grid: { left: 120, right: 40, top: 20, bottom: 60 },
    xAxis: {
      type: 'category',
      data: months,
      splitArea: { show: true },
      axisLabel: { color: t.muted, rotate: 40 },
    },
    yAxis: {
      type: 'category',
      data: categories,
      axisLabel: { color: t.muted, width: 100, overflow: 'truncate' },
    },
    visualMap: {
      min: 0,
      max: max || 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: { color: ['#E8EEF4', '#2F5D8C'] },
      textStyle: { color: t.muted },
    },
    series: [
      {
        type: 'heatmap',
        data,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.3)' } },
      },
    ],
  }
}

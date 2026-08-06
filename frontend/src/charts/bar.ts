import type { Theme } from '@mui/material/styles'
import { chartTheme, toNumber, type NamedChartItem } from './theme'

export function buildBarOption(
  theme: Theme,
  items: NamedChartItem[],
  options: { horizontal?: boolean } = {},
) {
  const horizontal = options.horizontal ?? true
  const t = chartTheme(theme)
  const names = items.map((i) => i.name)
  const values = items.map((i) => toNumber(i.amount))

  if (horizontal) {
    return {
      color: t.palette,
      grid: { left: 100, right: 24, top: 16, bottom: 24 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'value',
        axisLabel: { color: t.muted },
        splitLine: { lineStyle: { color: t.divider } },
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLabel: { color: t.muted, width: 90, overflow: 'truncate' },
        axisLine: { lineStyle: { color: t.divider } },
      },
      series: [
        {
          type: 'bar',
          data: values,
          barMaxWidth: 28,
          itemStyle: { borderRadius: [0, 3, 3, 0] },
        },
      ],
    }
  }

  return {
    color: t.palette,
    grid: { left: 48, right: 20, top: 20, bottom: 48 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: { color: t.muted, rotate: names.length > 6 ? 30 : 0 },
      axisLine: { lineStyle: { color: t.divider } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: t.muted },
      splitLine: { lineStyle: { color: t.divider } },
    },
    series: [
      {
        type: 'bar',
        data: values,
        barMaxWidth: 36,
        itemStyle: { borderRadius: [3, 3, 0, 0] },
      },
    ],
  }
}

import type { Theme } from '@mui/material/styles'
import { chartTheme, toNumber, type NamedChartItem } from './theme'

export function buildPieOption(theme: Theme, items: NamedChartItem[]) {
  const t = chartTheme(theme)
  return {
    color: t.palette,
    tooltip: { trigger: 'item', formatter: '{b}: {c} € ({d}%)' },
    legend: { bottom: 0, type: 'scroll', textStyle: { color: t.muted } },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 2, borderColor: t.paper, borderWidth: 2 },
        label: { color: t.textColor },
        data: items.map((c) => ({ name: c.name, value: toNumber(c.amount) })),
      },
    ],
  }
}

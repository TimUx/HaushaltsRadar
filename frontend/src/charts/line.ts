import type { Theme } from '@mui/material/styles'
import { chartTheme } from './theme'

export type LinePoint = {
  month: string
  monthly_total: string | number
  is_forecast?: boolean
}

export function buildLineOption(theme: Theme, series: LinePoint[]) {
  const t = chartTheme(theme)
  return {
    color: t.palette,
    grid: { left: 48, right: 20, top: 24, bottom: 40 },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { color: t.muted } },
    xAxis: {
      type: 'category',
      data: series.map((p) => p.month),
      axisLabel: { color: t.muted },
      axisLine: { lineStyle: { color: t.divider } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: t.muted },
      splitLine: { lineStyle: { color: t.divider } },
    },
    series: [
      {
        name: 'Monatlich',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: series.map((p) => Number(p.monthly_total)),
        areaStyle: { opacity: 0.12 },
        markArea: {
          itemStyle: { color: 'rgba(47, 93, 140, 0.08)' },
          data: series.some((p) => p.is_forecast)
            ? [
                [
                  {
                    xAxis: series.find((p) => p.is_forecast)?.month,
                  },
                  { xAxis: series[series.length - 1]?.month },
                ],
              ]
            : [],
        },
      },
    ],
  }
}

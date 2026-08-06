import type { Theme } from '@mui/material/styles'
import { chartTheme } from './theme'

export type SankeyLink = { source: string; target: string; value: number }
export type SankeyNode = { name: string }

export function buildSankeyOption(
  theme: Theme,
  nodes: SankeyNode[],
  links: SankeyLink[],
) {
  const t = chartTheme(theme)
  return {
    color: t.palette,
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'sankey',
        emphasis: { focus: 'adjacency' },
        nodeAlign: 'justify',
        lineStyle: { color: 'gradient', curveness: 0.5 },
        label: { color: t.textColor },
        data: nodes,
        links,
      },
    ],
  }
}

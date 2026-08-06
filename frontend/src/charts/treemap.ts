import type { Theme } from '@mui/material/styles'
import { chartTheme, toNumber } from './theme'

export type HierarchyNode = {
  id?: number | string | null
  name: string
  value: string | number
  children?: HierarchyNode[]
}

function mapNode(node: HierarchyNode): Record<string, unknown> {
  const children = (node.children || []).map(mapNode)
  const base: Record<string, unknown> = {
    name: node.name,
    value: toNumber(node.value),
  }
  if (children.length) base.children = children
  return base
}

export function buildTreemapOption(theme: Theme, nodes: HierarchyNode[]) {
  const t = chartTheme(theme)
  return {
    color: t.palette,
    tooltip: {
      formatter: (params: { name: string; value: number }) =>
        `${params.name}: ${Number(params.value).toLocaleString('de-DE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} €`,
    },
    series: [
      {
        type: 'treemap',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        label: { show: true, formatter: '{b}', color: '#fff' },
        upperLabel: { show: true, height: 24, color: t.textColor },
        itemStyle: { borderColor: t.paper, borderWidth: 2, gapWidth: 2 },
        data: nodes.map(mapNode),
      },
    ],
  }
}

export function buildSunburstOption(theme: Theme, nodes: HierarchyNode[]) {
  const t = chartTheme(theme)
  return {
    color: t.palette,
    tooltip: {
      formatter: (params: { name: string; value: number }) =>
        `${params.name}: ${Number(params.value).toLocaleString('de-DE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} €`,
    },
    series: [
      {
        type: 'sunburst',
        radius: [0, '90%'],
        label: { color: t.textColor },
        itemStyle: { borderWidth: 1, borderColor: t.paper },
        data: nodes.map(mapNode),
      },
    ],
  }
}

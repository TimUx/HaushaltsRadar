import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import ReactECharts from 'echarts-for-react'
import { analyticsApi } from '../api'

type TreeNode = {
  name: string
  value?: string
  itemStyle?: {
    color?: string
    borderColor?: string
    borderWidth?: number
  }
  label?: {
    color?: string
    fontWeight?: string | number
    backgroundColor?: string
    borderColor?: string
  }
  children?: TreeNode[]
}

function countLeaves(node: TreeNode): number {
  if (!node.children?.length) return 1
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0)
}

function maxDepth(node: TreeNode, depth = 1): number {
  if (!node.children?.length) return depth
  return Math.max(...node.children.map((child) => maxDepth(child, depth + 1)))
}

export function StructurePage() {
  const theme = useTheme()
  const { data, isLoading, error } = useQuery({
    queryKey: ['structure'],
    queryFn: analyticsApi.structure,
  })

  const treeData = useMemo<TreeNode | null>(() => {
    if (!data) return null

    const isDark = theme.palette.mode === 'dark'
    const paper = theme.palette.background.paper
    const primary = theme.palette.primary.main
    const mutedBorder = theme.palette.divider
    const text = theme.palette.text.primary

    const styleFor = (kind: string): Pick<TreeNode, 'itemStyle' | 'label'> => {
      if (kind === 'root') {
        return {
          itemStyle: {
            color: primary,
            borderColor: primary,
            borderWidth: 0,
          },
          label: {
            color: '#FFFFFF',
            fontWeight: 600,
            backgroundColor: primary,
            borderColor: primary,
          },
        }
      }
      if (kind === 'party' || kind === 'unassigned') {
        return {
          itemStyle: {
            color: isDark ? '#243447' : '#E8F0F7',
            borderColor: primary,
            borderWidth: 1,
          },
          label: {
            color: text,
            fontWeight: 600,
            backgroundColor: isDark ? '#243447' : '#E8F0F7',
            borderColor: primary,
          },
        }
      }
      if (kind === 'person') {
        return {
          itemStyle: {
            color: paper,
            borderColor: isDark ? '#6B9BD2' : '#5B8FB9',
            borderWidth: 1,
          },
          label: {
            color: text,
            fontWeight: 500,
            backgroundColor: paper,
            borderColor: isDark ? '#6B9BD2' : '#5B8FB9',
          },
        }
      }
      return {
        itemStyle: {
          color: paper,
          borderColor: mutedBorder,
          borderWidth: 1,
        },
        label: {
          color: text,
          fontWeight: 400,
          backgroundColor: paper,
          borderColor: mutedBorder,
        },
      }
    }

    const partyChildren: TreeNode[] = data.parties.map((party) => {
      const children: TreeNode[] = [
        ...party.persons.map((p) => {
          const personNode: TreeNode = {
            name: p.name,
            value: 'person',
            ...styleFor('person'),
          }
          if (p.objects?.length) {
            personNode.children = p.objects.map((o) => ({
              name: o.name,
              value: 'object',
              ...styleFor('object'),
            }))
          }
          return personNode
        }),
        ...party.objects.map((o) => ({
          name: o.name,
          value: 'object',
          ...styleFor('object'),
        })),
      ]

      return {
        name: party.name,
        value: 'party',
        ...styleFor('party'),
        children: children.length
          ? children
          : [{ name: 'Keine Zuordnungen', value: 'empty', ...styleFor('object') }],
      }
    })

    if (data.unassigned_persons.length || data.unassigned_objects.length) {
      const children: TreeNode[] = [
        ...data.unassigned_persons.map((p) => {
          const personNode: TreeNode = {
            name: p.name,
            value: 'person',
            ...styleFor('person'),
          }
          if (p.objects?.length) {
            personNode.children = p.objects.map((o) => ({
              name: o.name,
              value: 'object',
              ...styleFor('object'),
            }))
          }
          return personNode
        }),
        ...data.unassigned_objects.map((o) => ({
          name: o.name,
          value: 'object',
          ...styleFor('object'),
        })),
      ]
      partyChildren.push({
        name: 'Nicht zugeordnet',
        value: 'unassigned',
        ...styleFor('unassigned'),
        children,
      })
    }

    return {
      name: data.root_name,
      value: 'root',
      ...styleFor('root'),
      children: partyChildren.length
        ? partyChildren
        : [{ name: 'Noch keine Parteien', value: 'empty', ...styleFor('object') }],
    }
  }, [data, theme])

  const option = useMemo(() => {
    if (!treeData) return null
    return {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: (params: { name?: string; data?: { value?: string } }) => {
          const kind = params.data?.value
          const labels: Record<string, string> = {
            root: 'Haushalt',
            party: 'Partei',
            person: 'Person',
            object: 'Objekt',
            unassigned: 'Ohne Zuordnung',
          }
          const kindLabel = kind ? labels[kind] || '' : ''
          return kindLabel ? `${params.name}<br/>${kindLabel}` : params.name
        },
      },
      series: [
        {
          type: 'tree',
          data: [treeData],
          top: 36,
          left: 40,
          bottom: 36,
          right: 40,
          layout: 'orthogonal',
          orient: 'TB',
          symbol: 'roundRect',
          symbolSize: [128, 34],
          expandAndCollapse: false,
          initialTreeDepth: -1,
          edgeShape: 'polyline',
          edgeForkPosition: '63%',
          roam: false,
          lineStyle: {
            color: theme.palette.mode === 'dark' ? '#3A4553' : '#C5D0DB',
            width: 1.5,
            curveness: 0,
          },
          label: {
            position: 'inside',
            verticalAlign: 'middle',
            align: 'center',
            fontSize: 12,
            fontFamily: 'IBM Plex Sans, Segoe UI, sans-serif',
            padding: [6, 8],
            width: 120,
            overflow: 'truncate',
            borderRadius: 4,
            borderWidth: 1,
          },
          leaves: {
            label: {
              position: 'inside',
              verticalAlign: 'middle',
              align: 'center',
            },
          },
          emphasis: {
            disabled: true,
          },
          animationDuration: 250,
          animationDurationUpdate: 250,
        },
      ],
    }
  }, [treeData, theme])

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if (error || !data || !option || !treeData) {
    return <Alert severity="error">Struktur konnte nicht geladen werden.</Alert>
  }

  const leaves = countLeaves(treeData)
  const depth = maxDepth(treeData)
  const chartHeight = Math.max(520, depth * 110 + 80, Math.ceil(leaves / 3) * 70)

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              mb: 1.5,
              px: 0.5,
            }}
          >
            {[
              { label: 'Haushalt', color: theme.palette.primary.main },
              {
                label: 'Partei',
                color: theme.palette.mode === 'dark' ? '#243447' : '#E8F0F7',
                border: theme.palette.primary.main,
              },
              {
                label: 'Person',
                color: theme.palette.background.paper,
                border: theme.palette.mode === 'dark' ? '#6B9BD2' : '#5B8FB9',
              },
              {
                label: 'Objekt',
                color: theme.palette.background.paper,
                border: theme.palette.divider,
              },
            ].map((item) => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: 0.5,
                    bgcolor: item.color,
                    border: `1px solid ${item.border || item.color}`,
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
          <ReactECharts option={option} style={{ height: chartHeight, width: '100%' }} notMerge />
        </CardContent>
      </Card>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        {data.parties.map((party) => (
          <Card key={party.id}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                {party.name}
              </Typography>
              {party.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {party.description}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                Personen
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {party.persons.length
                  ? party.persons
                      .map((p) => {
                        const objectNames = p.objects?.map((o) => o.name).join(', ')
                        return objectNames ? `${p.name} (${objectNames})` : p.name
                      })
                      .join(', ')
                  : '–'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Objekte
              </Typography>
              <Typography variant="body2">
                {party.objects.length
                  ? party.objects.map((o) => o.name).join(', ')
                  : '–'}
              </Typography>
            </CardContent>
          </Card>
        ))}
        {(data.unassigned_persons.length > 0 || data.unassigned_objects.length > 0) && (
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Nicht zugeordnet
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Personen
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {data.unassigned_persons.length
                  ? data.unassigned_persons
                      .map((p) => {
                        const objectNames = p.objects?.map((o) => o.name).join(', ')
                        return objectNames ? `${p.name} (${objectNames})` : p.name
                      })
                      .join(', ')
                  : '–'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Objekte
              </Typography>
              <Typography variant="body2">
                {data.unassigned_objects.length
                  ? data.unassigned_objects.map((o) => o.name).join(', ')
                  : '–'}
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>
    </Stack>
  )
}

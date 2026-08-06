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
  children?: TreeNode[]
}

export function StructurePage() {
  const theme = useTheme()
  const { data, isLoading, error } = useQuery({
    queryKey: ['structure'],
    queryFn: analyticsApi.structure,
  })

  const treeData = useMemo<TreeNode | null>(() => {
    if (!data) return null

    const partyChildren: TreeNode[] = data.parties.map((party) => {
      const children: TreeNode[] = []
      if (party.persons.length) {
        children.push({
          name: 'Personen',
          children: party.persons.map((p) => {
            const personNode: TreeNode = { name: p.name, value: 'person' }
            if (p.objects?.length) {
              personNode.children = p.objects.map((o) => ({ name: o.name, value: 'object' }))
            }
            return personNode
          }),
        })
      }
      if (party.objects.length) {
        children.push({
          name: 'Objekte',
          children: party.objects.map((o) => ({ name: o.name, value: 'object' })),
        })
      }
      if (!children.length) {
        children.push({ name: 'Noch keine Zuordnungen' })
      }
      return {
        name: party.name,
        value: 'party',
        children,
      }
    })

    const unassigned: TreeNode[] = []
    if (data.unassigned_persons.length) {
      unassigned.push({
        name: 'Personen',
        children: data.unassigned_persons.map((p) => {
          const personNode: TreeNode = { name: p.name, value: 'person' }
          if (p.objects?.length) {
            personNode.children = p.objects.map((o) => ({ name: o.name, value: 'object' }))
          }
          return personNode
        }),
      })
    }
    if (data.unassigned_objects.length) {
      unassigned.push({
        name: 'Objekte',
        children: data.unassigned_objects.map((o) => ({ name: o.name, value: 'object' })),
      })
    }
    if (unassigned.length) {
      partyChildren.push({
        name: 'Nicht zugeordnet',
        value: 'unassigned',
        children: unassigned,
      })
    }

    return {
      name: data.root_name,
      value: 'root',
      children: partyChildren.length
        ? partyChildren
        : [{ name: 'Noch keine Parteien angelegt' }],
    }
  }, [data])

  const option = useMemo(() => {
    if (!treeData) return null
    const isDark = theme.palette.mode === 'dark'
    return {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
      },
      series: [
        {
          type: 'tree',
          data: [treeData],
          top: 24,
          left: 24,
          bottom: 24,
          right: 140,
          symbol: 'roundRect',
          symbolSize: [110, 36],
          orient: 'LR',
          expandAndCollapse: true,
          initialTreeDepth: 3,
          edgeShape: 'polyline',
          edgeForkPosition: '50%',
          lineStyle: {
            color: theme.palette.divider,
            width: 1.5,
            curveness: 0,
          },
          label: {
            position: 'inside',
            verticalAlign: 'middle',
            align: 'center',
            fontSize: 12,
            color: theme.palette.text.primary,
            backgroundColor: theme.palette.background.paper,
            borderColor: theme.palette.divider,
            borderWidth: 1,
            borderRadius: 4,
            padding: [8, 10],
            width: 110,
            overflow: 'truncate',
          },
          leaves: {
            label: {
              position: 'inside',
              verticalAlign: 'middle',
              align: 'center',
            },
          },
          itemStyle: {
            color: isDark ? '#1A1D21' : '#FFFFFF',
            borderColor: theme.palette.primary.main,
            borderWidth: 1,
          },
          emphasis: {
            focus: 'descendant',
            itemStyle: {
              borderColor: theme.palette.primary.main,
              borderWidth: 2,
            },
          },
          animationDuration: 300,
          animationDurationUpdate: 300,
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

  if (error || !data || !option) {
    return <Alert severity="error">Struktur konnte nicht geladen werden.</Alert>
  }

  const chartHeight = Math.max(420, 180 + data.parties.length * 160)

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
          <ReactECharts
            option={option}
            style={{ height: chartHeight, width: '100%' }}
            notMerge
          />
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

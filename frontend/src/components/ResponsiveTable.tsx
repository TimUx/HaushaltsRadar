import {
  Table,
  TableContainer,
  useMediaQuery,
  type TableProps,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type { ReactNode } from 'react'

type Props = TableProps & {
  children: ReactNode
  /** Bleed into parent horizontal padding for full-width scroll (default true). */
  edgeToEdge?: boolean
}

/**
 * Horizontally scrollable table with medium density on phones
 * so cells and action buttons stay readable/tappable.
 */
export function ResponsiveTable({
  children,
  size,
  sx,
  edgeToEdge = true,
  ...props
}: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  return (
    <TableContainer
      sx={{
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        ...(edgeToEdge
          ? {
              mx: { xs: -2, sm: 0 },
              width: { xs: 'calc(100% + 32px)', sm: '100%' },
              px: { xs: 2, sm: 0 },
            }
          : { width: '100%' }),
      }}
    >
      <Table size={size ?? (isMobile ? 'medium' : 'small')} sx={sx} {...props}>
        {children}
      </Table>
    </TableContainer>
  )
}

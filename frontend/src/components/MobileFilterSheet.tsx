import type { ReactNode } from 'react'
import {
  Badge,
  Box,
  Button,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import FilterListIcon from '@mui/icons-material/FilterListOutlined'

/** Full-width controls inside the mobile filter sheet (≥16px avoids iOS zoom). */
export const filterSheetControlSx = {
  width: '100%',
  '& .MuiInputBase-root': { fontSize: 16 },
  '& .MuiInputLabel-root': { fontSize: 16 },
} as const

type TriggerProps = {
  activeCount: number
  onClick: () => void
}

/** Compact toolbar button that opens the filter sheet. */
export function MobileFilterTrigger({ activeCount, onClick }: TriggerProps) {
  return (
    <Badge color="primary" badgeContent={activeCount} invisible={activeCount === 0}>
      <Button
        size="small"
        variant={activeCount > 0 ? 'contained' : 'outlined'}
        startIcon={<FilterListIcon />}
        onClick={onClick}
        aria-haspopup="dialog"
      >
        Filter
      </Button>
    </Badge>
  )
}

type SheetProps = {
  open: boolean
  onClose: () => void
  title?: string
  onReset?: () => void
  resetLabel?: string
  children: ReactNode
}

/**
 * Bottom sheet for filter forms on phones — keeps the page header compact.
 */
export function MobileFilterSheet({
  open,
  onClose,
  title = 'Filter',
  onReset,
  resetLabel = 'Zurücksetzen',
  children,
}: SheetProps) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
            maxHeight: '88dvh',
            pb: 'env(safe-area-inset-bottom, 0px)',
          },
        },
      }}
    >
      <Box sx={{ px: 2, pt: 1, pb: 2.5 }}>
        <Box
          aria-hidden
          sx={{
            width: 36,
            height: 4,
            borderRadius: 2,
            bgcolor: 'divider',
            mx: 'auto',
            mb: 1.5,
          }}
        />
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
        >
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
          <IconButton aria-label="Schließen" onClick={onClose} edge="end">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Stack spacing={2}>{children}</Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
          {onReset && (
            <Button size="medium" onClick={onReset} sx={{ flexShrink: 0 }}>
              {resetLabel}
            </Button>
          )}
          <Button size="medium" variant="contained" fullWidth onClick={onClose}>
            Fertig
          </Button>
        </Stack>
      </Box>
    </Drawer>
  )
}

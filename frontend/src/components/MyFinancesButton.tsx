import PersonIcon from '@mui/icons-material/PersonOutlined'
import { Button, IconButton, Tooltip } from '@mui/material'
import { useAuth } from '../auth/AuthContext'

type Props = {
  active: boolean
  onToggle: () => void
  size?: 'small' | 'medium'
  /** Compact AppBar control for narrow screens */
  iconOnly?: boolean
}

export function MyFinancesButton({ active, onToggle, size = 'small', iconOnly = false }: Props) {
  const { user } = useAuth()
  const label = 'Meine Finanzen'
  const disabledTitle = 'In der Benutzerverwaltung eine Person zuweisen'

  if (iconOnly) {
    if (!user?.person_id) {
      return (
        <Tooltip title={disabledTitle}>
          <span>
            <IconButton size={size} disabled aria-label={label}>
              <PersonIcon />
            </IconButton>
          </span>
        </Tooltip>
      )
    }
    return (
      <Tooltip title={label}>
        <IconButton
          size={size}
          color={active ? 'primary' : 'default'}
          aria-label={label}
          aria-pressed={active}
          onClick={onToggle}
          sx={active ? { bgcolor: 'action.selected' } : undefined}
        >
          <PersonIcon />
        </IconButton>
      </Tooltip>
    )
  }

  if (!user?.person_id) {
    return (
      <Tooltip title={disabledTitle}>
        <span>
          <Button size={size} variant="outlined" disabled startIcon={<PersonIcon />}>
            {label}
          </Button>
        </span>
      </Tooltip>
    )
  }

  return (
    <Button
      size={size}
      variant={active ? 'contained' : 'outlined'}
      color={active ? 'primary' : 'inherit'}
      startIcon={<PersonIcon />}
      onClick={onToggle}
    >
      {label}
    </Button>
  )
}

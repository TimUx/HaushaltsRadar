import PersonIcon from '@mui/icons-material/PersonOutlined'
import { Button, Tooltip } from '@mui/material'
import { useAuth } from '../auth/AuthContext'

type Props = {
  active: boolean
  onToggle: () => void
  size?: 'small' | 'medium'
}

export function MyFinancesButton({ active, onToggle, size = 'small' }: Props) {
  const { user } = useAuth()
  if (!user?.person_id) {
    return (
      <Tooltip title="In der Benutzerverwaltung eine Person zuweisen">
        <span>
          <Button size={size} variant="outlined" disabled startIcon={<PersonIcon />}>
            Meine Finanzen
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
      Meine Finanzen
    </Button>
  )
}

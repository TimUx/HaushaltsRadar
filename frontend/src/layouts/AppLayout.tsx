import { useMemo, useState } from 'react'
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/DashboardOutlined'
import AccountTreeIcon from '@mui/icons-material/AccountTreeOutlined'
import TableChartIcon from '@mui/icons-material/TableChartOutlined'
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined'
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined'
import PeopleIcon from '@mui/icons-material/PeopleOutlined'
import HomeWorkIcon from '@mui/icons-material/HomeWorkOutlined'
import GroupsIcon from '@mui/icons-material/GroupsOutlined'
import CategoryIcon from '@mui/icons-material/CategoryOutlined'
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeIcon from '@mui/icons-material/LightModeOutlined'
import LoginIcon from '@mui/icons-material/Login'
import LogoutIcon from '@mui/icons-material/Logout'
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const DRAWER_WIDTH = 240

interface AppLayoutProps {
  mode: 'light' | 'dark'
  onToggleMode: () => void
}

export function AppLayout({ mode, onToggleMode }: AppLayoutProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { isAuthenticated, user, logout } = useAuth()

  const navItems = useMemo(() => {
    const items = [
      { label: 'Dashboard', to: '/', icon: <DashboardIcon /> },
      { label: 'Struktur', to: '/struktur', icon: <AccountTreeIcon /> },
      { label: 'Kostenübersicht', to: '/kostenuebersicht', icon: <TableChartIcon /> },
    ]
    if (isAuthenticated) {
      items.push(
        { label: 'Kosten', to: '/kosten', icon: <PaymentsIcon /> },
        { label: 'Verträge', to: '/vertraege', icon: <DescriptionIcon /> },
        { label: 'Personen', to: '/personen', icon: <PeopleIcon /> },
        { label: 'Parteien', to: '/parteien', icon: <GroupsIcon /> },
        { label: 'Objekte', to: '/objekte', icon: <HomeWorkIcon /> },
        { label: 'Kategorien', to: '/kategorien', icon: <CategoryIcon /> },
      )
    }
    return items
  }, [isAuthenticated])

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        <Typography variant="h6" noWrap>
          KostenPilot
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1, flex: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.to}
            component={RouterLink}
            to={item.to}
            selected={location.pathname === item.to}
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 1, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        {isAuthenticated ? (
          <Button
            fullWidth
            variant="outlined"
            startIcon={<LogoutIcon />}
            onClick={logout}
          >
            Abmelden ({user?.username})
          </Button>
        ) : (
          <Button
            fullWidth
            variant="contained"
            startIcon={<LoginIcon />}
            component={RouterLink}
            to="/login"
          >
            Anmelden
          </Button>
        )}
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {navItems.find((i) => i.to === location.pathname)?.label || 'KostenPilot'}
          </Typography>
          <IconButton onClick={onToggleMode} aria-label="Theme umschalten">
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: 8,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}

import { useMemo, useState, type ReactNode } from 'react'
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
  ListSubheader,
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
import TimelineIcon from '@mui/icons-material/TimelineOutlined'
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined'
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined'
import PeopleIcon from '@mui/icons-material/PeopleOutlined'
import HomeWorkIcon from '@mui/icons-material/HomeWorkOutlined'
import GroupsIcon from '@mui/icons-material/GroupsOutlined'
import CategoryIcon from '@mui/icons-material/CategoryOutlined'
import LabelIcon from '@mui/icons-material/LabelOutlined'
import ManageAccountsIcon from '@mui/icons-material/ManageAccountsOutlined'
import StorageIcon from '@mui/icons-material/StorageOutlined'
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeIcon from '@mui/icons-material/LightModeOutlined'
import LoginIcon from '@mui/icons-material/Login'
import LogoutIcon from '@mui/icons-material/Logout'
import AssessmentIcon from '@mui/icons-material/AssessmentOutlined'
import InsightsIcon from '@mui/icons-material/InsightsOutlined'
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { MyFinancesButton } from '../components/MyFinancesButton'

const DRAWER_WIDTH = 240

interface AppLayoutProps {
  mode: 'light' | 'dark'
  onToggleMode: () => void
}

type NavItem = {
  label: string
  to: string
  icon: ReactNode
}

type NavSection = {
  title: string
  items: NavItem[]
}

export function AppLayout({ mode, onToggleMode }: AppLayoutProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuth()

  const financePaths = ['/', '/analysen', '/historie', '/kostenuebersicht', '/kosten']
  const myFinancesActive = new URLSearchParams(location.search).get('meine') === '1'

  function toggleMyFinances() {
    if (!user?.person_id) return
    const target = financePaths.includes(location.pathname) ? location.pathname : '/'
    const params = new URLSearchParams(location.pathname === target ? location.search : '')
    if (myFinancesActive && location.pathname === target) {
      params.delete('meine')
      const qs = params.toString()
      navigate(qs ? `${target}?${qs}` : target)
      return
    }
    params.set('meine', '1')
    navigate(`${target}?${params.toString()}`)
  }

  const navSections = useMemo<NavSection[]>(() => {
    if (!isAuthenticated || !user) return []

    const sections: NavSection[] = [
      {
        title: 'Überblick',
        items: [
          { label: 'Dashboard', to: '/', icon: <DashboardIcon /> },
          { label: 'Analysen', to: '/analysen', icon: <InsightsIcon /> },
          { label: 'Berichte', to: '/berichte', icon: <AssessmentIcon /> },
          { label: 'Struktur', to: '/struktur', icon: <AccountTreeIcon /> },
          { label: 'Kostenübersicht', to: '/kostenuebersicht', icon: <TableChartIcon /> },
          { label: 'Histororie', to: '/historie', icon: <TimelineIcon /> },
        ],
      },
    ]

    if (user.role === 'admin' || user.role === 'user') {
      sections.push(
        {
          title: 'Finanzen',
          items: [
            { label: 'Posten', to: '/kosten', icon: <PaymentsIcon /> },
            { label: 'Verträge', to: '/vertraege', icon: <DescriptionIcon /> },
          ],
        },
        {
          title: 'Organisation',
          items: [
            { label: 'Personen', to: '/personen', icon: <PeopleIcon /> },
            { label: 'Parteien', to: '/parteien', icon: <GroupsIcon /> },
            { label: 'Objekte', to: '/objekte', icon: <HomeWorkIcon /> },
            { label: 'Kategorien', to: '/kategorien', icon: <CategoryIcon /> },
            { label: 'Tags', to: '/tags', icon: <LabelIcon /> },
          ],
        },
      )
    }

    if (user.role === 'admin') {
      sections.push({
        title: 'Administration',
        items: [
          { label: 'Benutzer', to: '/benutzer', icon: <ManageAccountsIcon /> },
          { label: 'Daten & Backup', to: '/verwaltung', icon: <StorageIcon /> },
        ],
      })
    }

    return sections
  }, [isAuthenticated, user])

  const pageTitle =
    navSections.flatMap((section) => section.items).find((item) => item.to === location.pathname)
      ?.label || 'KostenPilot'

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        <Typography variant="h6" noWrap>
          KostenPilot
        </Typography>
      </Toolbar>
      <Divider />
      <Box sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
        {navSections.map((section, index) => (
          <Box key={section.title}>
            {index > 0 && <Divider sx={{ mx: 1.5, my: 0.5 }} />}
            <List
              dense
              subheader={
                <ListSubheader
                  component="div"
                  disableSticky
                  sx={{
                    bgcolor: 'transparent',
                    lineHeight: 2.2,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    px: 2,
                  }}
                >
                  {section.title}
                </ListSubheader>
              }
              sx={{ px: 1, py: 0 }}
            >
              {section.items.map((item) => (
                <ListItemButton
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  selected={location.pathname === item.to}
                  onClick={() => setMobileOpen(false)}
                  sx={{ borderRadius: 1, mb: 0.25 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              ))}
            </List>
          </Box>
        ))}
      </Box>
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
            {pageTitle}
          </Typography>
          {isAuthenticated && (
            <Box sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}>
              <MyFinancesButton active={myFinancesActive} onToggle={toggleMyFinances} />
            </Box>
          )}
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

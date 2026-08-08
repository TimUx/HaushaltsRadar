import { createTheme, type ThemeOptions } from '@mui/material/styles'

const mobileUp = '@media (max-width:599.95px)'

const shared: ThemeOptions = {
  typography: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h4: {
      fontWeight: 600,
      letterSpacing: '-0.02em',
      [mobileUp]: { fontSize: '1.65rem' },
    },
    h5: {
      fontWeight: 600,
      [mobileUp]: { fontSize: '1.45rem' },
    },
    h6: {
      fontWeight: 600,
      [mobileUp]: { fontSize: '1.2rem' },
    },
    body1: {
      [mobileUp]: { fontSize: '1rem' },
    },
    body2: {
      [mobileUp]: { fontSize: '0.9375rem' },
    },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: 'none',
          [mobileUp]: {
            // Slightly larger root type on phones for denser MUI layouts
            fontSize: 16,
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid',
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          [mobileUp]: {
            minHeight: 40,
          },
        },
        sizeSmall: {
          [mobileUp]: {
            minHeight: 36,
            fontSize: '0.875rem',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          [mobileUp]: {
            padding: 10,
          },
        },
        sizeSmall: {
          [mobileUp]: {
            padding: 8,
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          // ≥16px prevents iOS Safari zooming into focused inputs
          [mobileUp]: { fontSize: '1rem' },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          [mobileUp]: {
            fontSize: '0.9375rem',
            paddingTop: 12,
            paddingBottom: 12,
          },
        },
        sizeSmall: {
          [mobileUp]: {
            fontSize: '0.9375rem',
            paddingTop: 10,
            paddingBottom: 10,
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          [mobileUp]: {
            minHeight: 48,
            paddingTop: 10,
            paddingBottom: 10,
          },
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'default' },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid',
          backgroundImage: 'none',
        },
      },
    },
  },
}

export function createAppTheme(mode: 'light' | 'dark') {
  const isDark = mode === 'dark'
  return createTheme({
    ...shared,
    palette: {
      mode,
      primary: {
        main: isDark ? '#6B9BD2' : '#2F5D8C',
      },
      secondary: {
        main: isDark ? '#9AA4B2' : '#5B6572',
      },
      background: {
        default: isDark ? '#121417' : '#F4F6F8',
        paper: isDark ? '#1A1D21' : '#FFFFFF',
      },
      divider: isDark ? '#2A2F36' : '#E2E6EB',
      text: {
        primary: isDark ? '#E8EAED' : '#1A1D21',
        secondary: isDark ? '#A0A7B2' : '#5B6572',
      },
    },
    components: {
      ...shared.components,
      MuiPaper: {
        ...shared.components?.MuiPaper,
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderColor: isDark ? '#2A2F36' : '#E2E6EB',
          },
        },
      },
      MuiCard: {
        ...shared.components?.MuiCard,
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderColor: isDark ? '#2A2F36' : '#E2E6EB',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderColor: isDark ? '#2A2F36' : '#E2E6EB',
            backgroundImage: 'none',
          },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'default' },
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${isDark ? '#2A2F36' : '#E2E6EB'}`,
            backgroundImage: 'none',
          },
        },
      },
    },
  })
}

import { createTheme, type ThemeOptions } from '@mui/material/styles'

const shared: ThemeOptions = {
  typography: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h4: { fontWeight: 600, letterSpacing: '-0.02em' },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: 'none',
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

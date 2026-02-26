import { idID } from '@mui/material/locale'
import { createTheme } from '@mui/material/styles'

export const appTheme = createTheme(
    {
        palette: {
            primary: {
                main: '#4f46e5',
            },
            background: {
                default: '#f8fafc',
            },
        },
        typography: {
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            button: {
                textTransform: 'none',
                fontWeight: 600,
            },
        },
        shape: {
            borderRadius: 10,
        },
        components: {
            MuiButton: {
                defaultProps: {
                    variant: 'text',
                    size: 'small',
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        boxShadow: 'none',
                    },
                },
            },
        },
    },
    idID,
)

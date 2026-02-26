import type { ReactNode } from 'react'
import { Button, type ButtonProps } from '@mui/material'

interface AppTextButtonProps extends ButtonProps {
    label: string
    icon?: ReactNode
}

export default function AppTextButton({ label, icon, ...props }: AppTextButtonProps) {
    return (
        <Button
            variant="text"
            startIcon={icon}
            sx={{
                minWidth: 'auto',
                px: 1.5,
                py: 0.75,
            }}
            {...props}
        >
            {label}
        </Button>
    )
}

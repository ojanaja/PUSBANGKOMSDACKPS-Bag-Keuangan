import type { ReactNode, ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface AppTextButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    label: ReactNode
    icon?: ReactNode
    color?: 'primary' | 'error' | 'default'
    fullWidth?: boolean
}

export default function AppTextButton({
    label,
    icon,
    color = 'default',
    fullWidth,
    className,
    disabled,
    ...props
}: AppTextButtonProps) {
    return (
        <button
            className={clsx(
                'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
                color === 'primary' && 'text-primary-600 hover:bg-primary-50',
                color === 'error' && 'text-red-600 hover:bg-red-50',
                color === 'default' && 'text-slate-600 hover:bg-slate-100',
                fullWidth && 'w-full',
                className,
            )}
            disabled={disabled}
            {...props}
        >
            {icon && <span className="shrink-0">{icon}</span>}
            {label}
        </button>
    )
}

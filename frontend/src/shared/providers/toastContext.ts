import { createContext } from 'react'

export type ToastType = 'error' | 'success'

export type ToastContextValue = {
    showToast: (message: string, type?: ToastType) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

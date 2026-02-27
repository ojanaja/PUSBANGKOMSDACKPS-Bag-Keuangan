import { useCallback, useMemo, useState, type PropsWithChildren } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { ToastContext, type ToastType } from './toastContext'

type ToastItem = {
    id: number
    type: ToastType
    message: string
}

export function ToastProvider({ children }: PropsWithChildren) {
    const [toasts, setToasts] = useState<ToastItem[]>([])

    const removeToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, [])

    const showToast = useCallback((message: string, type: ToastType = 'error') => {
        const id = Date.now() + Math.floor(Math.random() * 1000)
        setToasts((prev) => [...prev, { id, type, message }])
        window.setTimeout(() => removeToast(id), 4000)
    }, [removeToast])

    const value = useMemo(() => ({ showToast }), [showToast])

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="fixed top-4 right-4 z-9999 flex flex-col gap-2 pointer-events-none" aria-live="polite" role="status">
                {toasts.map((toast) => {
                    const isError = toast.type === 'error'
                    const Icon = isError ? AlertCircle : CheckCircle2
                    return (
                        <div
                            key={toast.id}
                            className={`pointer-events-auto min-w-70 max-w-sm rounded-xl border px-4 py-3 shadow-sm flex items-start gap-2 ${isError
                                ? 'bg-red-50 border-red-200 text-red-800'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                }`}
                        >
                            <Icon size={18} className="mt-0.5" />
                            <p className="text-sm font-medium flex-1">{toast.message}</p>
                            <button
                                type="button"
                                aria-label="Tutup notifikasi"
                                className="text-current/70 hover:text-current"
                                onClick={() => removeToast(toast.id)}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )
                })}
            </div>
        </ToastContext.Provider>
    )
}

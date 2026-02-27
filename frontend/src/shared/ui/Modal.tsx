import { useEffect, useRef, type PropsWithChildren } from 'react'
import { X } from 'lucide-react'

const widthMap = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '3xl': 'max-w-3xl',
    '5xl': 'max-w-5xl',
} as const

interface ModalProps extends PropsWithChildren {
    open: boolean
    onClose: () => void
    title: string
    maxWidth?: keyof typeof widthMap
    scrollable?: boolean
    hideHeader?: boolean
}

export default function Modal({
    open,
    onClose,
    title,
    children,
    maxWidth = 'lg',
    scrollable = false,
    hideHeader = false,
}: ModalProps) {
    const panelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [open, onClose])

    useEffect(() => {
        if (!open || !panelRef.current) return
        const panel = panelRef.current
        const focusable = panel.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        first?.focus()

        const trap = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return
            if (focusable.length === 0) {
                e.preventDefault()
                return
            }
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault()
                    last?.focus()
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault()
                    first?.focus()
                }
            }
        }
        document.addEventListener('keydown', trap)
        return () => document.removeEventListener('keydown', trap)
    }, [open])

    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={onClose}
        >
            <div
                ref={panelRef}
                className={`bg-white rounded-2xl shadow-2xl w-full ${widthMap[maxWidth]} ${scrollable ? 'max-h-[90vh] overflow-y-auto' : ''} animate-in zoom-in-95 duration-200`}
                onClick={(e) => e.stopPropagation()}
            >
                {!hideHeader && (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
                        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                        <button
                            type="button"
                            aria-label="Tutup dialog"
                            onClick={onClose}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                )}
                <div className={hideHeader ? '' : 'p-6'}>{children}</div>
            </div>
        </div>
    )
}

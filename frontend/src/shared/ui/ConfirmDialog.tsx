import { AlertCircle, Loader2 } from 'lucide-react'
import AppTextButton from './AppTextButton'
import Modal from './Modal'

interface ConfirmDialogProps {
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    loading?: boolean
    variant?: 'danger' | 'default'
    onConfirm: () => void
    onCancel: () => void
}

export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Konfirmasi',
    cancelLabel = 'Batal',
    loading = false,
    variant = 'default',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    return (
        <Modal open={open} onClose={onCancel} title={title} maxWidth="sm" hideHeader>
            <div className="p-6 text-center">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${variant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-primary-100 text-primary-600'}`}>
                    <AlertCircle size={28} />
                </div>
                <h3 className="font-bold text-lg text-slate-800 mb-2">{title}</h3>
                <p className="text-sm text-slate-500">{message}</p>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
                <AppTextButton label={cancelLabel} onClick={onCancel} disabled={loading} fullWidth />
                <AppTextButton
                    label={loading ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Memproses...</span> : confirmLabel}
                    onClick={onConfirm}
                    disabled={loading}
                    color={variant === 'danger' ? 'error' : 'primary'}
                    fullWidth
                />
            </div>
        </Modal>
    )
}

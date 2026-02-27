import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import AppTextButton from './AppTextButton'
import Modal from './Modal'

interface PromptDialogProps {
    open: boolean
    title: string
    label: string
    placeholder?: string
    submitLabel?: string
    cancelLabel?: string
    loading?: boolean
    onSubmit: (value: string) => void
    onCancel: () => void
}

export default function PromptDialog({
    open,
    title,
    label,
    placeholder = '',
    submitLabel = 'Kirim',
    cancelLabel = 'Batal',
    loading = false,
    onSubmit,
    onCancel,
}: PromptDialogProps) {
    const [value, setValue] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (value.trim()) {
            onSubmit(value.trim())
            setValue('')
        }
    }

    const handleCancel = () => {
        setValue('')
        onCancel()
    }

    return (
        <Modal open={open} onClose={handleCancel} title={title} maxWidth="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">{label}</label>
                    <textarea
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder}
                        required
                        rows={3}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                        autoFocus
                    />
                </div>
                <div className="flex gap-3">
                    <AppTextButton label={cancelLabel} onClick={handleCancel} disabled={loading} fullWidth />
                    <AppTextButton
                        label={loading ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Mengirim...</span> : submitLabel}
                        type="submit"
                        disabled={loading || !value.trim()}
                        color="primary"
                        fullWidth
                    />
                </div>
            </form>
        </Modal>
    )
}

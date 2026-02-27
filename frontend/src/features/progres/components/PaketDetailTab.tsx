import { formatCurrency } from '@/lib/formatCurrency'
import type { PaketDetail } from '@/features/progres/application/useProgres'

interface PaketDetailTabProps {
    paket: PaketDetail
}

export default function PaketDetailTab({ paket }: PaketDetailTabProps) {
    return (
        <div className="p-8 max-w-4xl">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-primary-500 rounded-full" />
                Informasi Detail Paket
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                {[
                    { label: 'Nama Paket Pekerjaan', value: paket.NamaPaket },
                    { label: 'Kasatker / Pejabat Pembuat Komitmen', value: paket.Kasatker },
                    { label: 'Lokasi Proyek', value: paket.Lokasi },
                    { label: 'Total Pagu DIPA', value: formatCurrency(paket.PaguPaket) },
                    { label: 'ID Paket', value: paket.ID, mono: true },
                ].map(({ label, value, mono }) => (
                    <div key={label} className="space-y-1">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{label}</span>
                        <p className={`text-slate-800 font-medium ${mono ? 'font-mono text-sm' : 'text-base'}`}>{value}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

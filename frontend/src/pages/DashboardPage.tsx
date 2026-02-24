import { ShieldAlert, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

// Mock data for compliance table
const mockPaket = [
    { id: '1', nama: 'Penyusunan Kurikulum Pelatihan 2026', pagu: 450_000_000, realisasiKeuangan: 65, realisasiFisik: 60, status: 'LENGKAP' as const },
    { id: '2', nama: 'Pengadaan Alat Praktik Lab Komputer', pagu: 1_200_000_000, realisasiKeuangan: 45, realisasiFisik: 20, status: 'PERINGATAN' as const },
    { id: '3', nama: 'Rehabilitasi Gedung Asrama', pagu: 3_500_000_000, realisasiKeuangan: 30, realisasiFisik: 0, status: 'TIDAK_LENGKAP' as const },
    { id: '4', nama: 'Pelatihan SDM Angkatan I', pagu: 200_000_000, realisasiKeuangan: 100, realisasiFisik: 100, status: 'LENGKAP' as const },
    { id: '5', nama: 'Pengadaan Furniture Ruang Kelas', pagu: 800_000_000, realisasiKeuangan: 50, realisasiFisik: 15, status: 'PERINGATAN' as const },
]

const statusConfig = {
    TIDAK_LENGKAP: { label: 'Tidak Lengkap', icon: XCircle, bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
    PERINGATAN: { label: 'Peringatan', icon: AlertTriangle, bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
    LENGKAP: { label: 'Lengkap', icon: CheckCircle2, bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)
}

export default function DashboardPage() {
    const criticalCount = mockPaket.filter(p => p.status === 'TIDAK_LENGKAP').length

    return (
        <div className="space-y-6">
            {/* Top Alert Banner */}
            {criticalCount > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-800 animate-pulse">
                    <ShieldAlert size={20} />
                    <span className="text-sm font-medium">
                        Perhatian: {criticalCount} Paket Pekerjaan memiliki realisasi pencairan tanpa bukti dukung fisik!
                    </span>
                </div>
            )}

            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Executive Dashboard</h1>
                <p className="text-sm text-slate-500 mt-1">Kesiapan Audit & Early Warning System</p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Total Paket', value: mockPaket.length, color: 'bg-primary-50 text-primary-700 border-primary-200' },
                    { label: 'Perlu Perhatian', value: mockPaket.filter(p => p.status !== 'LENGKAP').length, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                    { label: 'Siap Audit', value: mockPaket.filter(p => p.status === 'LENGKAP').length, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                ].map((stat) => (
                    <div key={stat.label} className={`rounded-xl border p-5 ${stat.color}`}>
                        <p className="text-sm font-medium opacity-80">{stat.label}</p>
                        <p className="text-3xl font-bold mt-1">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Compliance Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-800">Matriks Kepatuhan Audit</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-left text-slate-500 font-medium">
                                <th className="px-6 py-3">Nama Paket</th>
                                <th className="px-6 py-3 text-right">Pagu</th>
                                <th className="px-6 py-3 text-center">Realisasi Keu.</th>
                                <th className="px-6 py-3 text-center">Realisasi Fisik</th>
                                <th className="px-6 py-3 text-center">Status Audit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {mockPaket.map((paket) => {
                                const cfg = statusConfig[paket.status]
                                const Icon = cfg.icon
                                return (
                                    <tr
                                        key={paket.id}
                                        className={`hover:bg-slate-50 transition-colors ${paket.status === 'TIDAK_LENGKAP' ? 'cursor-pointer' : ''
                                            }`}
                                    >
                                        <td className="px-6 py-4 font-medium text-slate-800">{paket.nama}</td>
                                        <td className="px-6 py-4 text-right text-slate-600 tabular-nums">
                                            {formatCurrency(paket.pagu)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-semibold">{paket.realisasiKeuangan}%</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`font-semibold ${paket.realisasiFisik < paket.realisasiKeuangan * 0.9 ? 'text-red-600' : ''
                                                }`}>
                                                {paket.realisasiFisik}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                                <Icon size={14} />
                                                {cfg.label}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

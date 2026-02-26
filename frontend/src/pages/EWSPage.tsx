import { useEffect, useState } from 'react'
import {
    ShieldAlert,
    AlertTriangle,
    CheckCircle2,
    TrendingDown,
    FileWarning,
    ArrowRight,
    Search,
    Calendar
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/shared/ui/PageHeader'
import AppLoader from '@/shared/ui/AppLoader'

interface EWSItem {
    paket_id: string
    nama_paket: string
    status: 'TIDAK_LENGKAP' | 'PERINGATAN' | 'LENGKAP'
    alasan: string
    deviasi_fisik: number
    realisasi_keuangan_persen: number
    realisasi_fisik_persen: number
}

const statusBadgeClass: Record<EWSItem['status'], string> = {
    TIDAK_LENGKAP: 'bg-red-100 text-red-600',
    PERINGATAN: 'bg-yellow-100 text-yellow-600',
    LENGKAP: 'bg-green-100 text-green-600'
}

const statusLabel: Record<EWSItem['status'], string> = {
    TIDAK_LENGKAP: 'Tidak Lengkap',
    PERINGATAN: 'Peringatan',
    LENGKAP: 'Lengkap'
}

export default function EWSPage() {
    const [data, setData] = useState<EWSItem[]>([])
    const [loading, setLoading] = useState(true)
    const [tahun, setTahun] = useState(new Date().getFullYear())
    const [searchTerm, setSearchTerm] = useState('')
    const navigate = useNavigate()

    const fetchData = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/v1/dashboard/ews?tahun=${tahun}`, { credentials: 'include' })
            if (res.ok) {
                const json = await res.json()
                setData(json || [])
            }
        } catch (err) {
            console.error('Gagal mengambil data EWS', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [tahun])

    const filteredData = data.filter(item =>
        item.nama_paket.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const stats = {
        critical: data.filter(d => d.status === 'TIDAK_LENGKAP').length,
        warning: data.filter(d => d.status === 'PERINGATAN').length,
        clear: data.filter(d => d.status === 'LENGKAP').length,
    }

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Sistem Peringatan Dini (EWS)"
                description="Pemantauan kepatuhan dan risiko paket pekerjaan secara waktu nyata."
                actions={(
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select
                            value={tahun}
                            onChange={(e) => setTahun(Number(e.target.value))}
                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        >
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y}>Tahun {y}</option>
                            ))}
                        </select>
                    </div>
                )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                        <ShieldAlert size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Masalah Kritis</p>
                        <p className="text-2xl font-bold text-slate-800">{stats.critical}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Peringatan</p>
                        <p className="text-2xl font-bold text-slate-800">{stats.warning}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                        <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Kondisi Aman</p>
                        <p className="text-2xl font-bold text-slate-800">{stats.clear}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-800">Daftar Analisis Risiko</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Cari nama paket..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {loading ? (
                        <AppLoader label="Memuat data EWS..." />
                    ) : filteredData.length === 0 ? (
                        <div className="p-20 text-center">
                            <p className="text-slate-400">Tidak ada data paket untuk ditampilkan.</p>
                        </div>
                    ) : (
                        filteredData.map(item => (
                            <div key={item.paket_id} className="p-6 hover:bg-slate-50/50 transition-colors group">
                                <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="space-y-3 flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusBadgeClass[item.status]}`}>
                                                {statusLabel[item.status]}
                                            </span>
                                            <h3 className="font-bold text-slate-800">{item.nama_paket}</h3>
                                        </div>

                                        <div className="flex items-center gap-2 text-sm text-slate-600 italic">
                                            {item.status === 'TIDAK_LENGKAP' ? <FileWarning size={16} className="text-red-500" /> :
                                                item.status === 'PERINGATAN' ? <TrendingDown size={16} className="text-yellow-600" /> :
                                                    <CheckCircle2 size={16} className="text-green-500" />}
                                            {item.alasan}
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Keuangan</p>
                                                <p className="text-sm font-semibold text-slate-700">{item.realisasi_keuangan_persen.toFixed(1)}%</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Fisik</p>
                                                <p className="text-sm font-semibold text-slate-700">{item.realisasi_fisik_persen.toFixed(1)}%</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Deviasi</p>
                                                <p className={`text-sm font-bold ${item.deviasi_fisik < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                    {item.deviasi_fisik > 0 ? '+' : ''}{item.deviasi_fisik.toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end">
                                        <button
                                            onClick={() => navigate(`/progres/${item.paket_id}`)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-primary-600 hover:text-white transition-all group-hover:shadow-md"
                                        >
                                            Detail Paket
                                            <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

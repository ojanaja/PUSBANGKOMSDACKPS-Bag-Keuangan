import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { X, FileText, AlertCircle, ChevronLeft, Printer } from 'lucide-react'
import PageHeader from '@/shared/ui/PageHeader'
import AppLoader from '@/shared/ui/AppLoader'
import AppTextButton from '@/shared/ui/AppTextButton'
import { useKurvaS } from '@/features/kurvas/application/useKurvaS'
import { MONTHS_SHORT } from '@/shared/config/months'

const monthsShort = MONTHS_SHORT

export default function KurvaSPage() {
    const { id } = useParams()
    const tahun = new Date().getFullYear()
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

    const { data, isLoading: loading, error: queryError } = useKurvaS(id)
    const paket = data?.paket || null
    const chartData = data?.chartData || []
    const error = queryError instanceof Error ? queryError.message : null

    const handleChartClick = (data: { activePayload?: Array<{ payload?: { bulan: string } }> }) => {
        if (data?.activePayload?.[0]?.payload) {
            const payload = data.activePayload[0].payload
            const mIndex = monthsShort.indexOf(payload.bulan)
            setSelectedMonth(mIndex)
            setDrawerOpen(true)
        }
    }

    if (loading) return <AppLoader label="Menghitung proyeksi kurva-S..." />

    if (error || !paket) return (
        <div className="flex flex-col items-center justify-center py-40 gap-4 text-center">
            <AlertCircle size={48} className="text-red-400" />
            <p className="text-slate-800 font-bold text-xl">{error || 'Data tidak tersedia'}</p>
            <Link to="/progres-satker" className="text-primary-600 font-medium hover:underline">Kembali ke Daftar Paket</Link>
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/progres-satker" className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                    <ChevronLeft size={24} />
                </Link>
                <div className="flex-1">
                    <PageHeader
                        title="Visualisasi Kurva-S"
                        description={`${paket.NamaPaket} • ${paket.Kasatker}`}
                        actions={(
                            <div className="no-print">
                                <AppTextButton label="Cetak Kurva S" icon={<Printer size={16} />} onClick={() => window.print()} />
                            </div>
                        )}
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                        Grafik Kemajuan Kumulatif (%)
                    </h2>
                    <div className="flex items-center gap-6">
                        {[
                            { label: 'Rencana Fisik', color: '#22c55e', dashed: true },
                            { label: 'Realisasi Fisik', color: '#22c55e', dashed: false },
                            { label: 'Rencana Keuangan', color: '#6366f1', dashed: true },
                        ].map(l => (
                            <div key={l.label} className="flex items-center gap-2">
                                <div className={`w-8 h-0.5 ${l.dashed ? 'border-t-2 border-dashed' : 'bg-current'}`} style={{ color: l.color, backgroundColor: l.dashed ? 'transparent' : l.color }} />
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{l.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="h-112.5 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} onClick={handleChartClick}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                                dataKey="bulan"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }}
                                dy={10}
                            />
                            <YAxis
                                domain={[0, 100]}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }}
                                unit="%"
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                labelStyle={{ fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}
                                formatter={(value: number | undefined) => [value !== undefined ? `${value.toFixed(1)}%` : '-', '']}
                            />
                            <Line
                                type="monotone"
                                dataKey="rencanaKeu"
                                stroke="#6366f1"
                                strokeDasharray="6 4"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="rencanaFisik"
                                stroke="#22c55e"
                                strokeDasharray="6 4"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="realisasiFisik"
                                stroke="#22c55e"
                                strokeWidth={4}
                                dot={{ r: 6, strokeWidth: 2, fill: '#fff' }}
                                activeDot={{ r: 8, strokeWidth: 0 }}
                                connectNulls
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-center text-xs text-slate-400 mt-6 font-medium italic">
                    * Klik pada titik grafik untuk melihat rincian kendala dan dokumen pada bulan tersebut
                </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-800">Tabel Deviasi Kumulatif</h2>
                    <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-500 uppercase tracking-widest shadow-sm">TA {tahun}</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <caption className="sr-only">Tabel Deviasi Kumulatif</caption>
                        <thead>
                            <tr>
                                <th className="px-6 py-4 text-left">Bulan</th>
                                <th className="px-6 py-4 text-center">Rencana Fisik</th>
                                <th className="px-6 py-4 text-center">Realisasi Fisik</th>
                                <th className="px-6 py-4 text-center">Deviasi Fisik</th>
                                <th className="px-6 py-4 text-center">Rencana Keu.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {chartData.map((d) => {
                                const devFis = d.realisasiFisik !== null ? d.realisasiFisik - d.rencanaFisik : null
                                return (
                                    <tr key={d.bulan} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-700">{d.bulanFull}</td>
                                        <td className="px-6 py-4 text-center font-medium text-slate-500">{d.rencanaFisik.toFixed(1)}%</td>
                                        <td className="px-6 py-4 text-center font-bold text-slate-800">{d.realisasiFisik !== null ? `${d.realisasiFisik.toFixed(1)}%` : '-'}</td>
                                        <td className={`px-6 py-4 text-center font-bold ${devFis !== null && devFis < 0 ? 'text-red-500' : devFis !== null ? 'text-emerald-500' : 'text-slate-300'}`}>
                                            {devFis !== null ? `${devFis >= 0 ? '+' : ''}${devFis.toFixed(1)}%` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center font-medium text-slate-500">{d.rencanaKeu.toFixed(1)}%</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {
                drawerOpen && selectedMonth !== null && (
                    <>
                        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity" onClick={() => setDrawerOpen(false)} />
                        <div className="fixed top-0 right-0 h-full w-full max-w-112.5 bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
                            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Rincian Laporan</h3>
                                    <p className="text-sm text-slate-500 mt-0.5">{chartData[selectedMonth].bulanFull} {tahun}</p>
                                </div>
                                <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all text-slate-400">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Analisis Progres & Kendala</h4>
                                    <div className={`p-5 rounded-2xl border ${chartData[selectedMonth].kendala ? 'bg-amber-50 border-amber-100 text-amber-900' : 'bg-slate-50 border-slate-100 text-slate-500 italic text-sm'}`}>
                                        {chartData[selectedMonth].kendala || 'Tidak ada catatan kendala dilaporkan pada bulan ini.'}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dokumen Bukti Pendukung</h4>
                                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        <FileText size={40} className="text-slate-200 mx-auto mb-3" />
                                        <p className="text-sm text-slate-400 font-medium">Dokumen sedang disinkronisasi...</p>
                                        <Link to={`/progres/${id}`} className="mt-4 inline-flex text-xs font-bold text-primary-600 uppercase tracking-widest hover:underline">Kelola Dokumen Di Sini</Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )
            }
        </div >
    )
}

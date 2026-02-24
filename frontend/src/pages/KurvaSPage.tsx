import { useState } from 'react'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { X, Download, FileText } from 'lucide-react'

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const chartData = months.map((m, i) => ({
    bulan: m,
    rencanaKeu: Math.min(100, (i + 1) * 8.33),
    realisasiKeu: i < 8 ? Math.min(100, (i + 1) * 7.5 + Math.random() * 5) : null,
    rencanaFisik: Math.min(100, (i + 1) * 8.33),
    realisasiFisik: i < 8 ? Math.min(100, (i + 1) * 6.0 + Math.random() * 8) : null,
}))

// Mock SP2D drill-down data
const mockSP2D = [
    { nomor: 'SP2D-00456/2026', tanggal: '15 Agu 2026', nilai: 125_000_000, keterangan: 'Pembayaran Tahap II' },
    { nomor: 'SP2D-00457/2026', tanggal: '22 Agu 2026', nilai: 75_000_000, keterangan: 'Belanja Bahan Pelatihan' },
]

const mockDokumen = [
    { name: 'Kwitansi_Aug_Payment.pdf', size: '320 KB' },
    { name: 'BAST_Tahap_II.pdf', size: '1.1 MB' },
    { name: 'Foto_Progress_50persen.jpg', size: '2.4 MB' },
]

function formatCurrency(v: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)
}

export default function KurvaSPage() {
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [selectedMonth, setSelectedMonth] = useState('')

    const handleChartClick = (data: { activeLabel?: string }) => {
        if (data?.activeLabel) {
            setSelectedMonth(data.activeLabel)
            setDrawerOpen(true)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Kurva-S Proyek</h1>
                <p className="text-sm text-slate-500 mt-1">Pengadaan Alat Praktik Lab Komputer</p>
            </div>

            {/* Chart Component */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Visualisasi Kurva-S</h2>
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData} onClick={handleChartClick}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="bulan" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#94a3b8" unit="%" />
                        <Tooltip
                            formatter={(value: number) => `${value.toFixed(1)}%`}
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                        />
                        <Legend
                            wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
                            onClick={() => { }}
                        />
                        <Line type="monotone" dataKey="rencanaKeu" name="Rencana Keuangan" stroke="#6366f1" strokeDasharray="8 4" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="realisasiKeu" name="Realisasi Keuangan" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, cursor: 'pointer' }} activeDot={{ r: 6 }} connectNulls={false} />
                        <Line type="monotone" dataKey="rencanaFisik" name="Rencana Fisik" stroke="#22c55e" strokeDasharray="8 4" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="realisasiFisik" name="Realisasi Fisik" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, cursor: 'pointer' }} activeDot={{ r: 6 }} connectNulls={false} />
                    </LineChart>
                </ResponsiveContainer>
                <p className="text-xs text-slate-400 mt-2 text-center">Klik titik pada grafik untuk melihat rincian transaksi & bukti bulan tersebut</p>
            </div>

            {/* Deviation Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-800">Rekap Deviasi</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 font-medium">
                                <th className="px-4 py-3 text-left">Bulan</th>
                                <th className="px-4 py-3 text-center">Rencana Keu.</th>
                                <th className="px-4 py-3 text-center">Realisasi Keu.</th>
                                <th className="px-4 py-3 text-center">Deviasi Keu.</th>
                                <th className="px-4 py-3 text-center">Rencana Fisik</th>
                                <th className="px-4 py-3 text-center">Realisasi Fisik</th>
                                <th className="px-4 py-3 text-center">Deviasi Fisik</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {chartData.map((d) => {
                                const devKeu = d.realisasiKeu !== null ? d.realisasiKeu - d.rencanaKeu : null
                                const devFis = d.realisasiFisik !== null ? d.realisasiFisik - d.rencanaFisik : null
                                return (
                                    <tr key={d.bulan} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 font-medium text-slate-700">{d.bulan}</td>
                                        <td className="px-4 py-2 text-center tabular-nums">{d.rencanaKeu.toFixed(1)}%</td>
                                        <td className="px-4 py-2 text-center tabular-nums">{d.realisasiKeu?.toFixed(1) ?? '-'}%</td>
                                        <td className={`px-4 py-2 text-center tabular-nums font-semibold ${devKeu !== null && devKeu < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                                            {devKeu !== null ? `${devKeu > 0 ? '+' : ''}${devKeu.toFixed(1)}%` : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-center tabular-nums">{d.rencanaFisik.toFixed(1)}%</td>
                                        <td className="px-4 py-2 text-center tabular-nums">{d.realisasiFisik?.toFixed(1) ?? '-'}%</td>
                                        <td className={`px-4 py-2 text-center tabular-nums font-semibold ${devFis !== null && devFis < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                                            {devFis !== null ? `${devFis > 0 ? '+' : ''}${devFis.toFixed(1)}%` : '-'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Right Drawer (Drill-Down) */}
            {drawerOpen && (
                <>
                    <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setDrawerOpen(false)} />
                    <div className="fixed top-0 right-0 h-full w-full max-w-[40%] min-w-[360px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-full duration-300">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-900">
                                Rincian Transaksi & Bukti - {selectedMonth} 2026
                            </h3>
                            <button onClick={() => setDrawerOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* SP2D Table */}
                            <div>
                                <h4 className="text-sm font-semibold text-slate-700 mb-3">Rincian SP2D Cair</h4>
                                <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                                    <thead>
                                        <tr className="bg-slate-50 text-left text-slate-500 font-medium">
                                            <th className="px-4 py-2">No. SP2D</th>
                                            <th className="px-4 py-2">Tanggal</th>
                                            <th className="px-4 py-2 text-right">Nilai</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {mockSP2D.map((sp) => (
                                            <tr key={sp.nomor}>
                                                <td className="px-4 py-2 font-mono text-xs text-primary-600">{sp.nomor}</td>
                                                <td className="px-4 py-2 text-slate-600">{sp.tanggal}</td>
                                                <td className="px-4 py-2 text-right tabular-nums font-medium">{formatCurrency(sp.nilai)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Document Cards */}
                            <div>
                                <h4 className="text-sm font-semibold text-slate-700 mb-3">Dokumen Bukti</h4>
                                <div className="space-y-2">
                                    {mockDokumen.map((doc) => (
                                        <div key={doc.name} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                                            <FileText size={28} className="text-red-500 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-700 truncate">{doc.name}</p>
                                                <p className="text-xs text-slate-400">{doc.size}</p>
                                            </div>
                                            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium hover:bg-primary-100 transition-colors">
                                                <Download size={14} />
                                                Unduh
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

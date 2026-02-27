import { ShieldAlert, AlertTriangle, CheckCircle2, XCircle, Loader2, AlertCircle, FileText, Download, Printer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts'
import { apiUrl } from '@/shared/api/httpClient'
import { useDashboardData, type StatusType } from '@/features/dashboard/application/useDashboardData'
import { formatCurrency } from '@/lib/formatCurrency'
import { FISCAL_YEAR_OPTIONS } from '@/shared/config/constants'

type ChartClickPayload = {
    activePayload?: Array<{
        payload?: {
            bulan?: number
        }
    }>
}

const statusConfig: Record<StatusType, { label: string, icon: LucideIcon, bg: string, text: string, border: string }> = {
    TIDAK_LENGKAP: { label: 'Tidak Lengkap', icon: XCircle, bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
    PERINGATAN: { label: 'Peringatan', icon: AlertTriangle, bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
    LENGKAP: { label: 'Lengkap', icon: CheckCircle2, bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
}

export default function DashboardPage() {
    const {
        tahun,
        setTahun,
        selectedMonth,
        setSelectedMonth,
        monthNames,
        rowData,
        criticalCount,
        paketQuery,
        chartQuery,
        drilldownQuery,
    } = useDashboardData()

    const chartData = chartQuery.data || []
    const drilldown = drilldownQuery.data || []
    const loadingPaket = paketQuery.isLoading
    const loadingDrilldown = drilldownQuery.isFetching

    const handleChartClick = (e: unknown) => {
        const event = e as ChartClickPayload
        if (event && event.activePayload && event.activePayload.length > 0) {
            const payload = event.activePayload[0].payload
            if (payload && payload.bulan) {
                setSelectedMonth(payload.bulan)
            }
        }
    }

    if (loadingPaket) return (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 size={40} className="text-primary-600 animate-spin" />
            <p className="text-slate-500 font-medium">Menganalisis Kepatuhan Anggaran...</p>
        </div>
    )

    const errorMsg = paketQuery.error instanceof Error ? paketQuery.error.message : null

    return (
        <div className="space-y-6">
            {errorMsg && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-800">
                    <AlertCircle size={20} />
                    <span className="text-sm font-medium">{errorMsg}</span>
                </div>
            )}

            {criticalCount > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-800 animate-pulse shadow-sm">
                    <ShieldAlert size={20} />
                    <span className="text-sm font-medium">
                        Perhatian: {criticalCount} Paket Pekerjaan memiliki realisasi pencairan (SP2D) tanpa bukti fisik/lapangan!
                    </span>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Dasbor Eksekutif</h1>
                    <p className="text-sm text-slate-500 mt-1">Kesiapan pemeriksaan dan pemantauan kepatuhan (EWS)</p>
                </div>
                <div className="flex items-center gap-3 no-print">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-500 font-medium whitespace-nowrap">Tahun Anggaran:</label>
                        <select
                            value={tahun}
                            onChange={(e) => setTahun(Number(e.target.value))}
                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-bold text-primary-600 shadow-sm"
                        >
                            {FISCAL_YEAR_OPTIONS.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm no-print"
                    >
                        <Printer size={16} />
                        Unduh laporan (PDF)
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Paket Pekerjaan', value: rowData.length, color: 'bg-white text-slate-900 border-slate-200' },
                    { label: 'Pagu DIPA Terkelola', value: formatCurrency(rowData.reduce((a, b) => a + b.PaguPaket, 0)), isCurrency: true, color: 'bg-primary-50 text-primary-700 border-primary-200' },
                    { label: 'Indikasi Masalah', value: rowData.filter(p => p.status !== 'LENGKAP').length, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                    { label: 'Siap Pemeriksaan', value: rowData.filter(p => p.status === 'LENGKAP').length, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                ].map((stat) => (
                    <div key={stat.label} className={`rounded-2xl border p-5 shadow-sm ${stat.color}`}>
                        <p className="text-xs font-bold uppercase tracking-wider opacity-70">{stat.label}</p>
                        <p className={`font-bold mt-2 ${stat.isCurrency ? 'text-xl' : 'text-3xl'}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="mb-6">
                    <h2 className="text-lg font-bold text-slate-800">Tren Rencana vs Realisasi Anggaran & Fisik</h2>
                    <p className="text-sm text-slate-500">Klik pada titik di grafik untuk melihat rincian pengeluaran per bulan (Drill-down).</p>
                </div>

                {chartData.length > 0 ? (
                    <div className="h-100 w-full cursor-pointer">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} onClick={handleChartClick} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} dy={10} />
                                <YAxis
                                    yAxisId="left"
                                    tickFormatter={(v) => `${(v / 1000000000).toFixed(0)} M`}
                                    tick={{ fill: '#64748B', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    tickFormatter={(v) => `${v}%`}
                                    tick={{ fill: '#64748B', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: unknown, name: string | number | undefined) => {
                                        const numValue = Number(value) || 0;
                                        const strName = String(name);
                                        if (strName.includes('Fisik')) return [`${numValue.toFixed(2)}%`, strName]
                                        return [formatCurrency(numValue), strName]
                                    }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                                <Line yAxisId="left" type="monotone" name="Rencana Keuangan" dataKey="rencana_keuangan" stroke="#93C5FD" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} activeDot={{ r: 8 }} />
                                <Line yAxisId="left" type="monotone" name="Realisasi Keuangan" dataKey="realisasi_keuangan" stroke="#2563EB" strokeWidth={4} dot={{ r: 6, fill: '#2563EB', strokeWidth: 2 }} activeDot={{ r: 8 }} />
                                <Line yAxisId="right" type="monotone" name="Rencana Fisik" dataKey="rencana_fisik" stroke="#FDBA74" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} activeDot={{ r: 8 }} />
                                <Line yAxisId="right" type="monotone" name="Realisasi Fisik" dataKey="realisasi_fisik" stroke="#EA580C" strokeWidth={4} dot={{ r: 6, fill: '#EA580C', strokeWidth: 2 }} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-50 flex items-center justify-center text-slate-400 italic bg-slate-50 rounded-xl">
                        Tidak ada grafik bulanan (belum ada paket)
                    </div>
                )}
            </div>

            {
                selectedMonth && (
                    <div className="bg-content-bg rounded-2xl border-2 border-primary-200 shadow-lg p-6 animate-in slide-in-from-bottom-5 fade-in duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold border-b border-primary-100 pb-2 text-primary-900 inline-block">
                                    Rincian Serapan & Bukti — Bulan {monthNames[selectedMonth - 1]}
                                </h2>
                            </div>
                            <button onClick={() => setSelectedMonth(null)} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={24} />
                            </button>
                        </div>

                        {loadingDrilldown ? (
                            <div className="flex py-10 justify-center">
                                <Loader2 className="animate-spin text-primary-600" />
                            </div>
                        ) : drilldown.length === 0 ? (
                            <p className="text-slate-500 italic text-center py-6">Belum ada realisasi untuk bulan ini.</p>
                        ) : (
                            <div className="space-y-4">
                                {drilldown.map((pkt, idx) => (
                                    <div key={pkt.paket_id || idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-slate-800 text-lg">{pkt.nama_paket}</h3>
                                            <div className="mt-3 grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs font-bold uppercase text-slate-400">Total Pencairan (Rp)</p>
                                                    <p className="font-medium text-slate-700">{formatCurrency(pkt.realisasi_keuangan)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold uppercase text-slate-400">Progres Fisik (%)</p>
                                                    <p className="font-medium text-slate-700">{pkt.realisasi_fisik}%</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-px bg-slate-100 hidden md:block"></div>
                                        <div className="flex-[1.5]">
                                            <p className="text-xs font-bold uppercase text-slate-400 mb-2">Dokumen Pendukung Bulan Ini</p>
                                            {pkt.dokumen && pkt.dokumen.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {pkt.dokumen.map((d, idx) => (
                                                        <li key={d.id || idx} className="bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100 rounded-lg p-2 flex items-center justify-between text-sm">
                                                            <div className="flex items-center gap-2 truncate">
                                                                <FileText size={16} className={d.kategori === 'KEUANGAN' ? 'text-blue-500' : 'text-orange-500'} />
                                                                <span className="font-medium text-slate-700 truncate">{d.original_name}</span>
                                                                <span className="text-xs font-bold bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">{d.jenis_dokumen}</span>
                                                            </div>
                                                            <a
                                                                href={apiUrl(`/documents/${d.id}`)}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="flex items-center gap-1 text-primary-600 hover:text-primary-800 font-medium px-2 py-1 rounded-md hover:bg-primary-50"
                                                            >
                                                                <Download size={14} /> Unduh
                                                            </a>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="h-full flex items-center justify-center p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                                    <span className="text-sm text-slate-400 italic">Tidak ada dokumen diunggah pada bulan ini</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800">Matriks Kepatuhan Laporan (Financial vs Physical)</h2>
                    <span className="text-xs font-medium text-slate-400">Data Terupdate Otomatis</span>
                </div>
                <div className="overflow-x-auto">
                    {rowData.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 italic">
                            Belum ada data paket pekerjaan untuk dianalisis.
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <caption className="sr-only">Matriks Kepatuhan Laporan</caption>
                            <thead>
                                <tr>
                                    <th className="px-6 py-4">Nama Paket Pekerjaan</th>
                                    <th className="px-6 py-4 text-right">Nilai Pagu</th>
                                    <th className="px-6 py-4 text-center">Realisasi Keu. (DIPA)</th>
                                    <th className="px-6 py-4 text-center">Realisasi Fisik (Aktual)</th>
                                    <th className="px-6 py-4 text-center">Status Compliance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rowData.map((paket, idx) => {
                                    const cfg = statusConfig[paket.status as StatusType]
                                    const Icon = cfg.icon
                                    return (
                                        <tr key={paket.ID || idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-5 font-bold text-slate-800">{paket.NamaPaket}</td>
                                            <td className="px-6 py-5 text-right font-medium text-slate-600 tabular-nums">
                                                {formatCurrency(paket.PaguPaket)}
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="font-bold text-slate-700">{paket.realisasiKeuangan}%</span>
                                                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500" style={{ width: `${paket.realisasiKeuangan}%` }} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`font-bold ${paket.realisasiFisik < paket.realisasiKeuangan * 0.9 ? 'text-red-600' : 'text-slate-700'}`}>
                                                        {paket.realisasiFisik}%
                                                    </span>
                                                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full ${paket.realisasiFisik < paket.realisasiKeuangan * 0.9 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${paket.realisasiFisik}%` }} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                                    <Icon size={14} />
                                                    {cfg.label}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div >
    )
}
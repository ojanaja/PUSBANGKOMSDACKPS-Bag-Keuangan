import { useState } from 'react'
import { Upload, Download, FileSpreadsheet, CheckCircle2, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAnggaran } from '@/features/anggaran/application/useAnggaran'
import ImportPreviewModal from '@/features/anggaran/components/ImportPreviewModal'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/formatCurrency'


function RKKSTreeRow({ node, level = 0 }: { node: any, level?: number }) {
    const [open, setOpen] = useState(level < 1)
    const hasChildren = node.children && node.children.length > 0

    return (
        <>
            <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                <td className="px-6 py-3" style={{ paddingLeft: `${24 + level * 24}px` }}>
                    <div className="flex items-center gap-2">
                        {hasChildren ? (
                            <button onClick={() => setOpen(!open)} className="text-slate-400 hover:text-slate-600">
                                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                        ) : (
                            <span className="w-4" />
                        )}
                        <span className="font-mono text-xs text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">{node.kode}</span>
                        <span className="text-sm text-slate-700">{node.uraian}</span>
                    </div>
                </td>
                <td className="px-6 py-3 text-right text-sm tabular-nums">{formatCurrency(node.pagu_revisi)}</td>
                <td className="px-6 py-3 text-right text-sm tabular-nums">{formatCurrency(node.realisasi_sd_periode)}</td>
                <td className={`px-6 py-3 text-right text-sm tabular-nums font-semibold ${node.sisa_anggaran < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                    {formatCurrency(node.sisa_anggaran)}
                </td>
            </tr>
            {open && hasChildren && node.children!.map((child: any, index: number) => (
                <RKKSTreeRow key={child.id || `child-${index}`} node={child} level={level + 1} />
            ))}
        </>
    )
}

function RKKSTable({
    tahun, setTahun,
    bulan, setBulan,
    revisi, setRevisi
}: {
    tahun: number, setTahun: (v: number) => void,
    bulan: number, setBulan: (v: number) => void,
    revisi: string, setRevisi: (v: string) => void
}) {
    const queryClient = useQueryClient()

    const formatedBulan = String(bulan).padStart(2, '0')
    const periodeStr = `${tahun}-${formatedBulan}-Rev${revisi}`

    const { query } = useAnggaran(tahun, periodeStr, 'rkks,fa_detail,emon')
    const hasData = query.data && query.data.length > 0;

    const MONTH_OPTIONS = [
        { value: 1, label: 'Januari' },
        { value: 2, label: 'Februari' },
        { value: 3, label: 'Maret' },
        { value: 4, label: 'April' },
        { value: 5, label: 'Mei' },
        { value: 6, label: 'Juni' },
        { value: 7, label: 'Juli' },
        { value: 8, label: 'Agustus' },
        { value: 9, label: 'September' },
        { value: 10, label: 'Oktober' },
        { value: 11, label: 'November' },
        { value: 12, label: 'Desember' }
    ]

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
            <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-slate-50">
                <div className="flex flex-wrap items-center justify-start gap-2">
                    <select
                        value={tahun}
                        onChange={(e) => setTahun(Number(e.target.value))}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-medium"
                        title="Tahun Anggaran"
                    >
                        {[tahun - 1, tahun, tahun + 1].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>

                    <select
                        value={bulan}
                        onChange={(e) => setBulan(Number(e.target.value))}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-medium"
                        title="Bulan"
                    >
                        {MONTH_OPTIONS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>

                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white" title="Nomor Revisi">
                        <span className="px-3 py-2 text-sm text-slate-500 border-r border-slate-200 bg-slate-50 font-medium">
                            Rev
                        </span>
                        <select
                            value={revisi}
                            onChange={(e) => setRevisi(e.target.value)}
                            className="w-16 px-2 py-2 text-sm focus:outline-none font-medium bg-white cursor-pointer"
                        >
                            {Array.from({ length: 21 }, (_, i) => (
                                <option key={i} value={i.toString()}>{i}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <button
                    onClick={() => {
                        queryClient.invalidateQueries({ queryKey: ['anggaran'] });
                        query.refetch();
                    }}
                    disabled={query.isFetching || query.isLoading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 bg-white hover:bg-slate-50 transition-colors shadow-sm font-medium shrink-0"
                    title="Perbarui Data"
                >
                    <RefreshCw size={16} className={query.isFetching || query.isLoading ? 'animate-spin' : ''} />
                    Perbarui Data
                </button>
            </div>

            <div className="overflow-x-auto min-h-[300px]">
                {query.isLoading ? (
                    <div className="p-10 flex justify-center text-slate-500">Memuat data RKKS...</div>
                ) : !hasData ? (
                    <div className="p-10 flex justify-center text-slate-500">Belum ada data RKKS untuk periode <strong>{periodeStr}</strong></div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-3 text-xs font-semibold text-slate-500 tracking-wider">KODE & URAIAN</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 tracking-wider">PAGU REVISI</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 tracking-wider">REALISASI</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 tracking-wider">SISA</th>
                            </tr>
                        </thead>
                        <tbody>
                            {query.data?.map((node: any) => (
                                <RKKSTreeRow key={node.id} node={node} />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}

export default function AnggaranImportPage() {
    const queryClient = useQueryClient()
    const currentUser = useAuthStore(s => s.user)
    const canCreate = currentUser?.Permissions?.includes('anggaran:create')

    const [showImportModal, setShowImportModal] = useState(false)

    // Lifted state from RKKSTable
    const [tahun, setTahun] = useState(new Date().getFullYear())
    const [bulan, setBulan] = useState(new Date().getMonth() + 1)
    const [revisi, setRevisi] = useState('1')

    const [lastImportResult, setLastImportResult] = useState<{ tahun: number, periode?: string } | null>(null)

    const { previewMutation, confirmImportMutation, createSnapshotMutation } = useAnggaran(tahun)

    if (!canCreate) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-base text-slate-600">Anda tidak memiliki akses ke halaman ini.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Import DIPA / RKKS</h1>
                <p className="text-base text-slate-600 mt-1">Unggah dokumen anggaran resmi dalam format Excel</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col items-center text-center">
                    <div className="p-4 bg-primary-50 rounded-2xl mb-5">
                        <Upload size={36} className="text-primary-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Unggah File Excel</h2>
                    <p className="text-sm text-slate-500 mb-6 max-w-sm">
                        Upload file Excel laporan anggaran dari SPAN/SAKTI atau e-Monitoring. Sistem akan mendeteksi format dan menampilkan preview sebelum disimpan.
                    </p>
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-all shadow-sm hover:shadow-md"
                    >
                        <FileSpreadsheet size={18} />
                        Mulai Import
                    </button>
                </div>

                {/* Download Template Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col items-center text-center">
                    <div className="p-4 bg-emerald-50 rounded-2xl mb-5">
                        <Download size={36} className="text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Download Template</h2>
                    <p className="text-sm text-slate-500 mb-6 max-w-sm">
                        Unduh template Excel standar untuk memastikan data Anda sesuai format yang diterima oleh sistem.
                    </p>
                    <a
                        href="/templates/template_anggaran.xlsx"
                        download
                        className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md"
                    >
                        <Download size={18} />
                        Unduh Template .xlsx
                    </a>
                </div>
            </div>

            {/* Supported Formats */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-base font-bold text-slate-800 mb-4">Format yang Didukung</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="p-2 bg-primary-100 rounded-lg shrink-0">
                            <FileSpreadsheet size={18} className="text-primary-600" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Laporan FA Detail (16 Segmen)</p>
                            <p className="text-xs text-slate-500 mt-0.5">Format standar dari SPAN/SAKTI</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
                            <FileSpreadsheet size={18} className="text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Pagu Realisasi EMON</p>
                            <p className="text-xs text-slate-500 mt-0.5">Format dari e-Monitoring</p>
                        </div>
                    </div>
                </div>
                <p className="text-xs text-slate-400 mt-4">
                    Format akan dideteksi otomatis. Hanya file Excel (.xlsx, .xls) yang diterima.
                </p>
            </div>

            {/* Last import result */}
            {lastImportResult && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                    <p className="text-sm text-emerald-800">
                        Import terakhir berhasil untuk Tahun Anggaran <strong>{lastImportResult.tahun}</strong>.
                    </p>
                </div>
            )}

            <RKKSTable
                tahun={tahun} setTahun={setTahun}
                bulan={bulan} setBulan={setBulan}
                revisi={revisi} setRevisi={setRevisi}
            />

            {showImportModal && (
                <ImportPreviewModal
                    onClose={() => setShowImportModal(false)}
                    onImported={({ tahun: importedTahun, bulan: importedBulan, periode }) => {
                        setLastImportResult({ tahun: importedTahun, periode })
                        setTahun(importedTahun)
                        if (importedBulan) setBulan(importedBulan)
                        if (periode) {
                            const revMatch = periode.match(/-Rev(\d+)$/)
                            if (revMatch) setRevisi(revMatch[1])
                        }
                        setShowImportModal(false)
                    }}
                    previewMutation={previewMutation}
                    confirmImportMutation={confirmImportMutation}
                    createSnapshotMutation={createSnapshotMutation}
                />
            )}
        </div>
    )
}
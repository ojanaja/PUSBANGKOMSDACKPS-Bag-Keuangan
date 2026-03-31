import { useState, useRef } from 'react'
import { Upload, ChevronRight, X, RefreshCw, AlertCircle, CheckCircle2, Loader2, Plus, FolderKanban, FileText, Database, Eye, ExternalLink } from 'lucide-react'
import { useAnggaran, useAnggaranDokumen, type TreeNode } from '@/features/anggaran/application/useAnggaran'
import FileDropzone from '@/features/progres/components/FileDropzone'
import { apiUrl } from '@/shared/api/httpClient'
import { formatCurrency } from '@/lib/formatCurrency'
import { FISCAL_YEAR_OPTIONS } from '@/shared/config/constants'

const MONTH_OPTIONS = [
    { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' }, { value: 3, label: 'Maret' },
    { value: 4, label: 'April' }, { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' }, { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' }, { value: 11, label: 'November' }, { value: 12, label: 'Desember' }
]

function Breadcrumbs({ path, onNavigate }: { path: TreeNode[], onNavigate: (index: number) => void }) {
    return (
        <nav className="flex items-center text-base text-slate-600 mb-4 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <button
                onClick={() => onNavigate(-1)}
                className="hover:text-primary-600 font-medium transition-colors flex items-center gap-1.5 shrink-0"
            >
                <Database size={18} />
                Kembali ke Daftar Utama
            </button>
            {path.map((node, i) => (
                <div key={node.id} className="flex items-center shrink-0">
                    <ChevronRight size={18} className="mx-1.5 text-slate-300" />
                    <button
                        onClick={() => onNavigate(i)}
                        className={`hover:text-primary-600 transition-colors flex items-center gap-1.5 ${i === path.length - 1 ? 'font-bold text-slate-800' : 'font-medium'}`}
                    >
                        {i === path.length - 1 ? <FolderKanban size={16} className="text-primary-500" /> : null}
                        <span className="truncate max-w-[200px]">{node.kode}</span>
                    </button>
                </div>
            ))}
        </nav>
    )
}

function FolderRow({ node, onClick, onUpload }: { node: TreeNode; onClick: () => void; onUpload: (node: TreeNode) => void }) {
    const hasChildren = node.children && node.children.length > 0
    const persentase = node.pagu_revisi > 0 ? (node.realisasi_sd_periode / node.pagu_revisi) * 100 : 0
    
    return (
        <tr 
            onClick={hasChildren ? onClick : undefined}
            className={`transition-colors ${hasChildren ? 'hover:bg-primary-50 cursor-pointer' : 'hover:bg-slate-50'}`}
        >
            <td className="px-6 py-4 border-b border-slate-100">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                        {hasChildren ? <FolderKanban size={24} className="text-primary-500" /> : <FileText size={24} className="text-slate-400" />}
                    </div>
                    <div>
                        <div className="font-mono text-sm text-primary-700 bg-primary-50 px-2 py-0.5 rounded inline-block font-semibold mb-1">{node.kode}</div>
                        <div className="text-base text-slate-700 line-clamp-2" title={node.uraian}>{node.uraian}</div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-5 text-right border-b border-slate-100 align-top">
                <div className="text-base font-semibold tabular-nums text-slate-800">{formatCurrency(node.pagu_revisi)}</div>
            </td>
            <td className="px-6 py-5 text-right border-b border-slate-100 align-top">
                <div className="text-base tabular-nums text-slate-600">{formatCurrency(node.lock_pagu)}</div>
            </td>
            <td className="px-6 py-5 text-right text-base tabular-nums text-slate-600 border-b border-slate-100 align-top">{formatCurrency(node.realisasi_periode_lalu)}</td>
            <td className="px-6 py-5 text-right text-base tabular-nums text-primary-700 font-medium border-b border-slate-100 align-top">{formatCurrency(node.realisasi_periode_ini)}</td>
            <td className="px-6 py-5 text-right border-b border-slate-100 align-top">
                <div className="text-base tabular-nums font-semibold text-slate-800">{formatCurrency(node.realisasi_sd_periode)}</div>
                <div className="text-sm text-slate-500 mt-1">{persentase.toFixed(2)}%</div>
            </td>
            <td className={`px-6 py-5 text-right text-base tabular-nums font-semibold border-b border-slate-100 align-top ${node.sisa_anggaran < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                {formatCurrency(node.sisa_anggaran)}
            </td>
            <td className="px-6 py-5 text-center border-b border-slate-100 align-top">
                {!hasChildren && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onUpload(node); }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-slate-200" 
                        title="Unggah dokumen bukti"
                    >
                        <Upload size={18} />
                        <span>Unggah</span>
                    </button>
                )}
            </td>
        </tr>
    )
}

export default function AnggaranPage() {
    const [showImportModal, setShowImportModal] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [tahun, setTahun] = useState(new Date().getFullYear())
    const [bulan, setBulan] = useState(new Date().getMonth() + 1)
    const [currentPath, setCurrentPath] = useState<TreeNode[]>([])
    const [uploadTarget, setUploadTarget] = useState<TreeNode | null>(null)

    const { query, importMutation, manualMutation, uploadBuktiMutation } = useAnggaran(tahun, bulan)
    const { data: uploadDocuments = [], refetch: refetchDocuments, isLoading: loadingDocs } = useAnggaranDokumen(uploadTarget?.id || null)

    const tree = query.data || []
    const loading = query.isLoading
    const error = query.error instanceof Error ? query.error.message : null

    const [importFile, setImportFile] = useState<File | null>(null)
    const [importTahun, setImportTahun] = useState(new Date().getFullYear())
    const [importResult, setImportResult] = useState<{ programs_upserted?: number; akun_upserted?: number } | null>(null)
    const [importError, setImportError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [showManualModal, setShowManualModal] = useState(false)
    const [manualTahun, setManualTahun] = useState(new Date().getFullYear())
    const [manualData, setManualData] = useState({
        program_kode: '', program_uraian: '',
        kegiatan_kode: '', kegiatan_uraian: '',
        output_kode: '', output_uraian: '',
        suboutput_kode: '', suboutput_uraian: '',
        akun_kode: '', akun_uraian: '',
        pagu: '', realisasi: '', sisa: ''
    })
    const [manualError, setManualError] = useState<string | null>(null)

    const totalPagu = tree.reduce((sum, p) => sum + p.pagu_revisi, 0)
    const totalRealisasi = tree.reduce((sum, p) => sum + p.realisasi_sd_periode, 0)
    const totalSisa = tree.reduce((sum, p) => sum + p.sisa_anggaran, 0)

    const handleImport = async () => {
        if (!importFile) return

        setImportError(null)
        setImportResult(null)

        try {
            const data = await importMutation.mutateAsync({ file: importFile, tahun: importTahun })
            setImportResult(data)
            setImportFile(null)
            setTahun(importTahun)
        } catch (e) {
            setImportError(e instanceof Error ? e.message : 'Terjadi kesalahan')
        }
    }

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const files = e.dataTransfer.files
        if (files.length > 0) {
            setImportFile(files[0])
            setImportResult(null)
            setImportError(null)
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            setImportFile(files[0])
            setImportResult(null)
            setImportError(null)
        }
    }

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setManualError(null)

        try {
            const payload = {
                tahun_anggaran: manualTahun,
                program_kode: manualData.program_kode,
                program_uraian: manualData.program_uraian,
                kegiatan_kode: manualData.kegiatan_kode,
                kegiatan_uraian: manualData.kegiatan_uraian,
                output_kode: manualData.output_kode,
                output_uraian: manualData.output_uraian,
                suboutput_kode: manualData.suboutput_kode,
                suboutput_uraian: manualData.suboutput_uraian,
                akun_kode: manualData.akun_kode,
                akun_uraian: manualData.akun_uraian,
                pagu: Number(manualData.pagu) || 0,
                realisasi: Number(manualData.realisasi) || 0,
                sisa: Number(manualData.sisa) || 0,
            }

            await manualMutation.mutateAsync(payload)

            setShowManualModal(false)
            setManualData({
                program_kode: '', program_uraian: '',
                kegiatan_kode: '', kegiatan_uraian: '',
                output_kode: '', output_uraian: '',
                suboutput_kode: '', suboutput_uraian: '',
                akun_kode: '', akun_uraian: '',
                pagu: '', realisasi: '', sisa: ''
            })
            setTahun(manualTahun)
        } catch (e) {
            setManualError(e instanceof Error ? e.message : 'Terjadi kesalahan')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Pemantauan Anggaran</h1>
                    <p className="text-base text-slate-600 mt-1">Rekapitulasi Pelaksanaan Anggaran</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-base text-slate-600 font-medium">Tahun:</label>
                        <select
                            value={tahun}
                            onChange={(e) => { setTahun(Number(e.target.value)); setCurrentPath([]); }}
                            className="border border-slate-200 rounded-lg px-3 py-3 text-base bg-white"
                        >
                            {FISCAL_YEAR_OPTIONS.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-base text-slate-600 font-medium">Bulan:</label>
                        <select
                            value={bulan}
                            onChange={(e) => { setBulan(Number(e.target.value)); setCurrentPath([]); }}
                            className="border border-slate-200 rounded-lg px-3 py-3 text-base bg-white"
                        >
                            {MONTH_OPTIONS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => query.refetch()}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-3 border border-slate-200 rounded-lg text-base text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Perbarui Data
                    </button>
                    <button
                        onClick={() => { setShowManualModal(true); setManualError(null) }}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-700 rounded-lg text-base font-medium hover:bg-slate-200 transition-colors shadow-sm"
                    >
                        <Plus size={16} />
                        Tambah Manual
                    </button>
                    <button
                        onClick={() => { setShowImportModal(true); setImportResult(null); setImportError(null); setImportFile(null) }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
                    >
                        <Upload size={16} />
                        Unggah Excel/CSV
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <p className="text-base text-slate-600 font-medium">Total Pagu (Dana Tersedia)</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{formatCurrency(totalPagu)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <p className="text-base text-slate-600 font-medium">Total Dana Keluar (SP2D)</p>
                    <p className="text-3xl font-bold text-primary-600 mt-2">{formatCurrency(totalRealisasi)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <p className="text-base text-slate-600 font-medium">Sisa Anggaran</p>
                    <p className={`text-3xl font-bold mt-2 ${totalSisa < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatCurrency(totalSisa)}
                    </p>
                </div>
            </div>

            {tree.length > 0 && !loading && !error && (
                <Breadcrumbs 
                    path={currentPath} 
                    onNavigate={(idx) => setCurrentPath(idx === -1 ? [] : currentPath.slice(0, idx + 1))} 
                />
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-800">Daftar Anggaran</h2>
                    {tree.length > 0 && (
                        <span className="text-xs text-slate-400">
                            {tree.length} baris ditampilkan
                        </span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={28} className="text-primary-500 animate-spin" />
                            <span className="ml-3 text-base text-slate-600">Memuat data anggaran...</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <AlertCircle size={32} className="text-red-400 mb-3" />
                            <p className="text-sm text-red-600 font-medium">{error}</p>
                            <button onClick={() => query.refetch()} className="mt-3 text-sm text-primary-600 hover:underline">Coba lagi</button>
                        </div>
                    ) : tree.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <Upload size={40} className="text-slate-300 mb-3" />
                            <p className="text-base text-slate-600 font-medium">Belum ada data anggaran untuk tahun {tahun}</p>
                            <p className="text-sm text-slate-500 mt-1">Klik tombol "Unggah Excel/CSV" di atas untuk memasukkan data</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <caption className="sr-only">Rekapitulasi Anggaran</caption>
                            <thead>
                                <tr className="bg-slate-50 border-y border-slate-200">
                                    <th className="px-6 py-4 text-left font-semibold text-slate-700 text-base">Uraian / Nama Kegiatan</th>
                                    <th className="px-6 py-4 text-right font-semibold text-slate-700 text-base">Pagu Revisi</th>
                                    <th className="px-6 py-4 text-right font-semibold text-slate-700 text-base">Lock Pagu</th>
                                    <th className="px-6 py-4 text-right font-semibold text-slate-700 text-base">Bulan Lalu</th>
                                    <th className="px-6 py-4 text-right font-semibold text-slate-700 text-base">Bulan Ini</th>
                                    <th className="px-6 py-4 text-right font-semibold text-slate-700 text-base">Total s.d. Bulan Ini<br/>& Persentase</th>
                                    <th className="px-6 py-4 text-right font-semibold text-slate-700 text-base">Sisa Anggaran</th>
                                    <th className="px-6 py-4 text-center font-semibold text-slate-700 text-base">Pilihan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(()=>{
                                    const currentNodes = currentPath.length === 0 ? tree : currentPath[currentPath.length - 1].children || []
                                    if (currentNodes.length === 0) {
                                        return (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-8 text-center text-slate-600 text-base">
                                                    Tidak ada data di dalam kategori ini.
                                                </td>
                                            </tr>
                                        )
                                    }
                                    return currentNodes.map((node, index) => (
                                        <FolderRow 
                                            key={node.id || `node-${index}`} 
                                            node={node} 
                                            onClick={() => setCurrentPath([...currentPath, node])}
                                            onUpload={(n) => {
                                                setUploadTarget(n)
                                            }}
                                        />
                                    ))
                                })()}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {
                showImportModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowImportModal(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-slate-900">Unggah Excel / CSV Laporan Anggaran</h3>
                                <button onClick={() => setShowImportModal(false)} className="p-2 rounded-lg hover:bg-slate-100">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            <div className="mb-4">
                                <label className="block text-base font-medium text-slate-700 mb-1.5">Tahun Anggaran</label>
                                <select
                                    value={importTahun}
                                    onChange={(e) => setImportTahun(Number(e.target.value))}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base"
                                >
                                    {FISCAL_YEAR_OPTIONS.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>

                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleFileDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${isDragging ? 'border-primary-400 bg-primary-50' : importFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-primary-400'
                                    }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.xlsx"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                {importFile ? (
                                    <>
                                        <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                                        <p className="text-sm font-medium text-emerald-700">{importFile.name}</p>
                                        <p className="text-xs text-emerald-500 mt-1">{(importFile.size / 1024).toFixed(1)} KB — Klik untuk mengganti</p>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={32} className="mx-auto text-slate-300 mb-2" />
                                        <p className="text-base text-slate-600 font-medium">Seret file ke kotak ini</p>
                                        <p className="text-sm text-slate-500 mt-1">atau klik untuk memilih file dari komputer Anda</p>
                                    </>
                                )}
                            </div>

                            {importError && (
                                <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <AlertCircle size={16} className="text-red-500 shrink-0" />
                                    <p className="text-sm text-red-700">{importError}</p>
                                </div>
                            )}

                            {importResult && (
                                <div className="mt-4 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                    <p className="text-sm text-emerald-700">
                                        Import berhasil! {importResult.programs_upserted} program, {importResult.akun_upserted} akun diproses.
                                    </p>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setShowImportModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={!importFile || importMutation.isPending}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {importMutation.isPending ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Mengimport...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={18} />
                                            Mulai Proses Data
                                        </>
                                    )}
                                </button>
                            </div>

                            <p className="text-xs text-slate-400 mt-4">
                                Format: CSV dengan kolom ProgramKode, ProgramUraian, KegiatanKode, KegiatanUraian,
                                OutputKode, OutputUraian, SubOutputKode, SubOutputUraian, AkunKode, AkunUraian, Pagu, Realisasi, Sisa
                            </p>
                        </div>
                    </div>
                )
            }

            {
                showManualModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowManualModal(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pb-2 border-b border-slate-100">
                                <h3 className="text-xl font-bold text-slate-900">Tambah Data Anggaran Secara Manual</h3>
                                <button onClick={() => setShowManualModal(false)} className="p-2 rounded-lg hover:bg-slate-100">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            <form onSubmit={handleManualSubmit}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-base font-medium text-slate-700 mb-1.5">Tahun Anggaran</label>
                                        <select
                                            value={manualTahun}
                                            onChange={(e) => setManualTahun(Number(e.target.value))}
                                            className="w-full lg:w-1/2 border border-slate-200 rounded-lg px-3 py-3 text-base"
                                            required
                                        >
                                            {FISCAL_YEAR_OPTIONS.map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-base font-medium text-slate-700 mb-1.5">Kode Program</label>
                                        <input type="text" value={manualData.program_kode} onChange={e => setManualData({ ...manualData, program_kode: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Contoh: 033.01.WA" required />
                                    </div>
                                    <div>
                                        <label className="block text-base font-medium text-slate-700 mb-1.5">Uraian Program</label>
                                        <input type="text" value={manualData.program_uraian} onChange={e => setManualData({ ...manualData, program_uraian: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Program Utama..." required />
                                    </div>

                                    <div>
                                        <label className="block text-base font-medium text-slate-700 mb-1.5">Kode Kegiatan</label>
                                        <input type="text" value={manualData.kegiatan_kode} onChange={e => setManualData({ ...manualData, kegiatan_kode: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Contoh: 4054" required />
                                    </div>
                                    <div>
                                        <label className="block text-base font-medium text-slate-700 mb-1.5">Uraian Kegiatan</label>
                                        <input type="text" value={manualData.kegiatan_uraian} onChange={e => setManualData({ ...manualData, kegiatan_uraian: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Kegiatan..." required />
                                    </div>

                                    <div>
                                        <label className="block text-base font-medium text-slate-700 mb-1.5">Kode Output</label>
                                        <input type="text" value={manualData.output_kode} onChange={e => setManualData({ ...manualData, output_kode: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Contoh: 4054.EBA" required />
                                    </div>
                                    <div>
                                        <label className="block text-base font-medium text-slate-700 mb-1.5">Uraian Output</label>
                                        <input type="text" value={manualData.output_uraian} onChange={e => setManualData({ ...manualData, output_uraian: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Output..." required />
                                    </div>

                                    <div>
                                        <label className="block text-base font-medium text-slate-700 mb-1.5">Kode SubOutput</label>
                                        <input type="text" value={manualData.suboutput_kode} onChange={e => setManualData({ ...manualData, suboutput_kode: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Contoh: 4054.EBA.994" required />
                                    </div>
                                    <div>
                                        <label className="block text-base font-medium text-slate-700 mb-1.5">Uraian SubOutput</label>
                                        <input type="text" value={manualData.suboutput_uraian} onChange={e => setManualData({ ...manualData, suboutput_uraian: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="SubOutput..." required />
                                    </div>

                                    <div>
                                        <label className="block text-base font-medium text-slate-700 mb-1.5">Kode Akun</label>
                                        <input type="text" value={manualData.akun_kode} onChange={e => setManualData({ ...manualData, akun_kode: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Contoh: 533111" required />
                                    </div>
                                    <div>
                                        <label className="block text-base font-medium text-slate-700 mb-1.5">Uraian Akun</label>
                                        <input type="text" value={manualData.akun_uraian} onChange={e => setManualData({ ...manualData, akun_uraian: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Belanja Modal..." required />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Pagu Anggaran (Rp)</label>
                                        <input type="number" value={manualData.pagu} onChange={e => setManualData({ ...manualData, pagu: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Realisasi Keluar (Rp)</label>
                                        <input type="number" value={manualData.realisasi} onChange={e => setManualData({ ...manualData, realisasi: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Sisa Anggaran (Rp)</label>
                                        <input type="number" value={manualData.sisa} onChange={e => setManualData({ ...manualData, sisa: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0" required />
                                    </div>
                                </div>

                                {manualError && (
                                    <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                        <AlertCircle size={16} className="text-red-500 shrink-0" />
                                        <p className="text-sm text-red-700">{manualError}</p>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowManualModal(false)}
                                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={manualMutation.isPending}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {manualMutation.isPending ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                Menyimpan...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={16} />
                                                Simpan Anggaran
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                uploadTarget && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setUploadTarget(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Arsip Digital</h3>
                                    <p className="text-base text-slate-600 mt-1 truncate max-w-[300px]" title={uploadTarget.uraian}>
                                        Unggah Dokumen Bukti untuk {uploadTarget.kode}
                                    </p>
                                </div>
                                <button onClick={() => setUploadTarget(null)} className="p-1 rounded-lg hover:bg-slate-100 shrink-0">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            <FileDropzone 
                                label="Unggah Dokumen Bukti" 
                                type="document" 
                                empty 
                                uploading={uploadBuktiMutation.isPending ? { progress: '' } : undefined}
                                onDrop={async (files) => {
                                    if (files.length > 0) {
                                        try {
                                            await uploadBuktiMutation.mutateAsync({ id: uploadTarget.id, file: files[0] })
                                            alert('Dokumen berhasil diunggah')
                                            refetchDocuments()
                                        } catch (e) {
                                            alert('Gagal mengunggah dokumen')
                                        }
                                    }
                                }} 
                            />

                            <div className="mt-6 space-y-3">
                                {loadingDocs ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 size={24} className="text-primary-500 animate-spin" />
                                    </div>
                                ) : uploadDocuments.length === 0 ? (
                                    <div className="text-center py-4 text-sm text-slate-500">
                                        Belum ada dokumen yang diunggah.
                                    </div>
                                ) : (
                                    uploadDocuments.map(doc => (
                                        <div key={doc.id} className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl group hover:border-primary-300 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                                    <FileText size={20} className="text-primary-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 truncate" title={doc.original_name}>{doc.original_name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
                                                            {(doc.file_size_bytes / 1024).toFixed(1)} KB
                                                        </span>
                                                        <span className="text-xs text-slate-400">
                                                            {new Date(doc.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {doc.mime_type.startsWith('image/') || doc.mime_type === 'application/pdf' ? (
                                                        <a href={apiUrl(`/documents/${doc.id}`)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-xs font-bold transition-all border border-sky-100" title="Lihat Dokumen">
                                                            <Eye size={14} /> Lihat
                                                        </a>
                                                    ) : null}
                                                    <a href={apiUrl(`/documents/${doc.id}?download=true`)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-all border border-indigo-100" title="Unduh Dokumen">
                                                        <ExternalLink size={14} /> Unduh
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setUploadTarget(null)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Tutup
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    )
}

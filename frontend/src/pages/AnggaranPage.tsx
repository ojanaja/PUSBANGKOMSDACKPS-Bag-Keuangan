import { useState, useRef } from 'react'
import { Upload, ChevronDown, ChevronRight, X, RefreshCw, AlertCircle, CheckCircle2, Loader2, Plus } from 'lucide-react'
import { useAnggaran, type TreeNode } from '@/features/anggaran/application/useAnggaran'
import { formatCurrency } from '@/lib/formatCurrency'
import { FISCAL_YEAR_OPTIONS } from '@/shared/config/constants'

function TreeRow({ node, level = 0 }: { node: TreeNode; level?: number }) {
    const [open, setOpen] = useState(level < 1)
    const hasChildren = node.children && node.children.length > 0

    return (
        <>
            <tr className="hover:bg-slate-50 transition-colors">
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
                <td className="px-6 py-3 text-right text-sm tabular-nums">{formatCurrency(node.pagu)}</td>
                <td className="px-6 py-3 text-right text-sm tabular-nums">{formatCurrency(node.realisasi)}</td>
                <td className={`px-6 py-3 text-right text-sm tabular-nums font-semibold ${node.sisa < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                    {formatCurrency(node.sisa)}
                </td>
            </tr>
            {open && hasChildren && node.children!.map((child, index) => (
                <TreeRow key={child.id || `child-${index}`} node={child} level={level + 1} />
            ))}
        </>
    )
}

export default function AnggaranPage() {
    const [showImportModal, setShowImportModal] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [tahun, setTahun] = useState(new Date().getFullYear())

    const { query, importMutation, manualMutation } = useAnggaran(tahun)
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

    const totalPagu = tree.reduce((sum, p) => sum + p.pagu, 0)
    const totalRealisasi = tree.reduce((sum, p) => sum + p.realisasi, 0)
    const totalSisa = tree.reduce((sum, p) => sum + p.sisa, 0)

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
                    <h1 className="text-2xl font-bold text-slate-900">Integrasi Data Anggaran</h1>
                    <p className="text-sm text-slate-500 mt-1">Data Anggaran DIPA Pusat</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-500 font-medium">Tahun:</label>
                        <select
                            value={tahun}
                            onChange={(e) => setTahun(Number(e.target.value))}
                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                            {FISCAL_YEAR_OPTIONS.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => query.refetch()}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button
                        onClick={() => { setShowManualModal(true); setManualError(null) }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors shadow-sm"
                    >
                        <Plus size={16} />
                        Input Manual
                    </button>
                    <button
                        onClick={() => { setShowImportModal(true); setImportResult(null); setImportError(null); setImportFile(null) }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
                    >
                        <Upload size={16} />
                        Import Laporan
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-sm text-slate-500 font-medium">Total Pagu DIPA</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalPagu)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-sm text-slate-500 font-medium">Total Realisasi SP2D</p>
                    <p className="text-2xl font-bold text-primary-600 mt-1">{formatCurrency(totalRealisasi)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-sm text-slate-500 font-medium">Sisa Anggaran</p>
                    <p className={`text-2xl font-bold mt-1 ${totalSisa < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatCurrency(totalSisa)}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-800">Hierarki Anggaran</h2>
                    {tree.length > 0 && (
                        <span className="text-xs text-slate-400">
                            {tree.length} program ditemukan
                        </span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={24} className="text-primary-500 animate-spin" />
                            <span className="ml-3 text-sm text-slate-500">Memuat data anggaran...</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <AlertCircle size={32} className="text-red-400 mb-3" />
                            <p className="text-sm text-red-600 font-medium">{error}</p>
                            <button onClick={() => query.refetch()} className="mt-3 text-sm text-primary-600 hover:underline">Coba lagi</button>
                        </div>
                    ) : tree.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <Upload size={32} className="text-slate-300 mb-3" />
                            <p className="text-sm text-slate-500 font-medium">Belum ada data anggaran untuk tahun {tahun}</p>
                            <p className="text-xs text-slate-400 mt-1">Klik "Import Laporan" untuk mengimpor data CSV</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <caption className="sr-only">Rekapitulasi Anggaran</caption>
                            <thead>
                                <tr>
                                    <th className="px-6 py-3">Program / Kegiatan / Output / Akun</th>
                                    <th className="px-6 py-3 text-right">Pagu</th>
                                    <th className="px-6 py-3 text-right">Realisasi</th>
                                    <th className="px-6 py-3 text-right">Sisa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {tree.map((node, index) => (
                                    <TreeRow key={node.id || `root-${index}`} node={node} />
                                ))}
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
                                <h3 className="text-lg font-bold text-slate-900">Import Laporan Anggaran</h3>
                                <button onClick={() => setShowImportModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tahun Anggaran</label>
                                <select
                                    value={importTahun}
                                    onChange={(e) => setImportTahun(Number(e.target.value))}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
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
                                        <p className="text-sm text-slate-600 font-medium">Drag & drop file CSV di sini</p>
                                        <p className="text-xs text-slate-400 mt-1">atau klik untuk memilih file</p>
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
                                            <Upload size={16} />
                                            Import Data
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
                                <h3 className="text-lg font-bold text-slate-900">Input Manual DIPA Anggaran</h3>
                                <button onClick={() => setShowManualModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            <form onSubmit={handleManualSubmit}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Tahun Anggaran</label>
                                        <select
                                            value={manualTahun}
                                            onChange={(e) => setManualTahun(Number(e.target.value))}
                                            className="w-full lg:w-1/2 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                            required
                                        >
                                            {FISCAL_YEAR_OPTIONS.map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Kode Program</label>
                                        <input type="text" value={manualData.program_kode} onChange={e => setManualData({ ...manualData, program_kode: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Contoh: 033.01.WA" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Uraian Program</label>
                                        <input type="text" value={manualData.program_uraian} onChange={e => setManualData({ ...manualData, program_uraian: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Program Utama..." required />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Kode Kegiatan</label>
                                        <input type="text" value={manualData.kegiatan_kode} onChange={e => setManualData({ ...manualData, kegiatan_kode: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Contoh: 4054" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Uraian Kegiatan</label>
                                        <input type="text" value={manualData.kegiatan_uraian} onChange={e => setManualData({ ...manualData, kegiatan_uraian: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Kegiatan..." required />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Kode Output</label>
                                        <input type="text" value={manualData.output_kode} onChange={e => setManualData({ ...manualData, output_kode: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Contoh: 4054.EBA" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Uraian Output</label>
                                        <input type="text" value={manualData.output_uraian} onChange={e => setManualData({ ...manualData, output_uraian: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Output..." required />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Kode SubOutput</label>
                                        <input type="text" value={manualData.suboutput_kode} onChange={e => setManualData({ ...manualData, suboutput_kode: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Contoh: 4054.EBA.994" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Uraian SubOutput</label>
                                        <input type="text" value={manualData.suboutput_uraian} onChange={e => setManualData({ ...manualData, suboutput_uraian: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="SubOutput..." required />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Kode Akun</label>
                                        <input type="text" value={manualData.akun_kode} onChange={e => setManualData({ ...manualData, akun_kode: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Contoh: 533111" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Uraian Akun</label>
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
        </div >
    )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, ChevronDown, ChevronRight, X, RefreshCw, AlertCircle, CheckCircle2, Loader2, Plus } from 'lucide-react'

interface AnggaranTreeRow {
    ProgramID: string
    ProgramKode: string
    ProgramUraian: string
    KegiatanID: string
    KegiatanKode: string
    KegiatanUraian: string
    OutputID: string
    OutputKode: string
    OutputUraian: string
    SubOutputID: string
    SubOutputKode: string
    SubOutputUraian: string
    AkunID: string
    AkunKode: string
    AkunUraian: string
    Pagu: number
    Realisasi: number
    Sisa: number
}

interface TreeNode {
    id: string
    kode: string
    uraian: string
    pagu: number
    realisasi: number
    sisa: number
    children?: TreeNode[]
}

function buildTree(rows: AnggaranTreeRow[]): TreeNode[] {
    const programMap = new Map<string, TreeNode>()
    console.log('Building tree from rows:', rows); 

    for (const row of rows) {
        const r = row as any;
        const ProgramID = r.ProgramID || r.program_id;
        const ProgramKode = r.ProgramKode || r.program_kode;
        const ProgramUraian = r.ProgramUraian || r.program_uraian;
        const KegiatanID = r.KegiatanID || r.kegiatan_id;
        const KegiatanKode = r.KegiatanKode || r.kegiatan_kode;
        const KegiatanUraian = r.KegiatanUraian || r.kegiatan_uraian;
        const OutputID = r.OutputID || r.output_id;
        const OutputKode = r.OutputKode || r.output_kode;
        const OutputUraian = r.OutputUraian || r.output_uraian;
        const SubOutputID = r.SubOutputID || r.sub_output_id;
        const SubOutputKode = r.SubOutputKode || r.sub_output_kode;
        const SubOutputUraian = r.SubOutputUraian || r.sub_output_uraian;
        const AkunID = r.AkunID || r.akun_id;
        const AkunKode = r.AkunKode || r.akun_kode;
        const AkunUraian = r.AkunUraian || r.akun_uraian;

        const pagu = typeof r.Pagu === 'number' ? r.Pagu : (typeof r.pagu === 'number' ? r.pagu : (parseFloat(String(r.Pagu || r.pagu)) || 0))
        const realisasi = typeof r.Realisasi === 'number' ? r.Realisasi : (typeof r.realisasi === 'number' ? r.realisasi : (parseFloat(String(r.Realisasi || r.realisasi)) || 0))
        const sisa = typeof r.Sisa === 'number' ? r.Sisa : (typeof r.sisa === 'number' ? r.sisa : (parseFloat(String(r.Sisa || r.sisa)) || 0))

        if (!ProgramID) continue; 

        if (!programMap.has(ProgramID)) {
            programMap.set(ProgramID, {
                id: ProgramID,
                kode: ProgramKode,
                uraian: ProgramUraian,
                pagu: 0, realisasi: 0, sisa: 0,
                children: [],
            })
        }
        const program = programMap.get(ProgramID)!

        let kegiatan = program.children!.find(k => k.id === KegiatanID)
        if (!kegiatan && KegiatanID) {
            kegiatan = {
                id: KegiatanID,
                kode: KegiatanKode,
                uraian: KegiatanUraian,
                pagu: 0, realisasi: 0, sisa: 0,
                children: [],
            }
            program.children!.push(kegiatan)
        }
        if (!kegiatan) continue;

        let output = kegiatan.children!.find(o => o.id === OutputID)
        if (!output && OutputID) {
            output = {
                id: OutputID,
                kode: OutputKode,
                uraian: OutputUraian,
                pagu: 0, realisasi: 0, sisa: 0,
                children: [],
            }
            kegiatan.children!.push(output)
        }
        if (!output) continue;

        let subOutput = output.children!.find(s => s.id === SubOutputID)
        if (!subOutput && SubOutputID) {
            subOutput = {
                id: SubOutputID,
                kode: SubOutputKode,
                uraian: SubOutputUraian,
                pagu: 0, realisasi: 0, sisa: 0,
                children: [],
            }
            output.children!.push(subOutput)
        }
        if (!subOutput) continue;

        const existingAkun = subOutput.children!.find(a => a.id === AkunID)
        if (existingAkun) {
            existingAkun.pagu += pagu
            existingAkun.realisasi += realisasi
            existingAkun.sisa += sisa
        } else if (AkunID) {
            subOutput.children!.push({
                id: AkunID,
                kode: AkunKode,
                uraian: AkunUraian,
                pagu, realisasi, sisa,
            })
        }

        subOutput.pagu += pagu
        subOutput.realisasi += realisasi
        subOutput.sisa += sisa

        output.pagu += pagu
        output.realisasi += realisasi
        output.sisa += sisa

        kegiatan.pagu += pagu
        kegiatan.realisasi += realisasi
        kegiatan.sisa += sisa

        program.pagu += pagu
        program.realisasi += realisasi
        program.sisa += sisa
    }

    return Array.from(programMap.values())
}

function formatCurrency(v: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)
}

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
    const [tree, setTree] = useState<TreeNode[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [importFile, setImportFile] = useState<File | null>(null)
    const [importTahun, setImportTahun] = useState(new Date().getFullYear())
    const [importing, setImporting] = useState(false)
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
    const [submittingManual, setSubmittingManual] = useState(false)
    const [manualError, setManualError] = useState<string | null>(null)

    const fetchTree = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/v1/anggaran/tree?tahun=${tahun}`, { credentials: 'include' })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.message || 'Gagal mengambil data anggaran')
            }
            const rows: AnggaranTreeRow[] = await res.json()
            setTree(buildTree(rows || []))
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Terjadi kesalahan')
            setTree([])
        } finally {
            setLoading(false)
        }
    }, [tahun])

    useEffect(() => {
        fetchTree()
    }, [fetchTree])

    const totalPagu = tree.reduce((sum, p) => sum + p.pagu, 0)
    const totalRealisasi = tree.reduce((sum, p) => sum + p.realisasi, 0)
    const totalSisa = tree.reduce((sum, p) => sum + p.sisa, 0)

    const handleImport = async () => {
        if (!importFile) return

        setImporting(true)
        setImportError(null)
        setImportResult(null)

        const formData = new FormData()
        formData.append('file', importFile)
        formData.append('tahun_anggaran', String(importTahun))

        try {
            const res = await fetch('/api/v1/anggaran/import', {
                method: 'POST',
                credentials: 'include',
                body: formData,
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.message || 'Gagal mengimport data')
            }

            const data = await res.json()
            setImportResult(data)
            setImportFile(null)
            setTahun(importTahun)
            setTimeout(() => {
                fetchTree()
            }, 500)
        } catch (e) {
            setImportError(e instanceof Error ? e.message : 'Terjadi kesalahan')
        } finally {
            setImporting(false)
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
        setSubmittingManual(true)
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

            const res = await fetch('/api/v1/anggaran/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.message || 'Gagal menyimpan data manual')
            }

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
            setTimeout(() => {
                fetchTree()
            }, 500)
        } catch (e) {
            setManualError(e instanceof Error ? e.message : 'Terjadi kesalahan')
        } finally {
            setSubmittingManual(false)
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
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={fetchTree}
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
                            <button onClick={fetchTree} className="mt-3 text-sm text-primary-600 hover:underline">Coba lagi</button>
                        </div>
                    ) : tree.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <Upload size={32} className="text-slate-300 mb-3" />
                            <p className="text-sm text-slate-500 font-medium">Belum ada data anggaran untuk tahun {tahun}</p>
                            <p className="text-xs text-slate-400 mt-1">Klik "Import Laporan" untuk mengimpor data CSV</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-left text-slate-500 font-medium">
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

            {showImportModal && (
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
                                {[2024, 2025, 2026, 2027].map(y => (
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
                                disabled={!importFile || importing}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {importing ? (
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
            )}

            {showManualModal && (
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
                                        {[2024, 2025, 2026, 2027].map(y => (
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
                                    disabled={submittingManual}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {submittingManual ? (
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
            )}
        </div>
    )
}

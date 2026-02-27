import { useRef, useState } from 'react'
import { Upload, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { UseMutationResult } from '@tanstack/react-query'
import { FISCAL_YEAR_OPTIONS } from '@/shared/config/constants'

interface ImportModalProps {
    onClose: () => void
    onImported: (tahun: number) => void
    importMutation: UseMutationResult<{ programs_upserted?: number; akun_upserted?: number }, Error, { file: File; tahun: number }>
}

export default function ImportModal({ onClose, onImported, importMutation }: ImportModalProps) {
    const [importFile, setImportFile] = useState<File | null>(null)
    const [importTahun, setImportTahun] = useState(new Date().getFullYear())
    const [importResult, setImportResult] = useState<{ programs_upserted?: number; akun_upserted?: number } | null>(null)
    const [importError, setImportError] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleImport = async () => {
        if (!importFile) return
        setImportError(null)
        setImportResult(null)
        try {
            const data = await importMutation.mutateAsync({ file: importFile, tahun: importTahun })
            setImportResult(data)
            setImportFile(null)
            onImported(importTahun)
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

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900">Import Laporan Anggaran</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
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
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${isDragging ? 'border-primary-400 bg-primary-50' : importFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-primary-400'}`}
                >
                    <input ref={fileInputRef} type="file" accept=".csv,.xlsx" onChange={handleFileSelect} className="hidden" />
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
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        Batal
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={!importFile || importMutation.isPending}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {importMutation.isPending ? (
                            <><Loader2 size={16} className="animate-spin" /> Mengimport...</>
                        ) : (
                            <><Upload size={16} /> Import Data</>
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

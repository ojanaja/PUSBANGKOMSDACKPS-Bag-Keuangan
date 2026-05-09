import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, Trash2, Download, Eye, CheckCircle2, AlertCircle, Loader2, X, ChevronUp, Calendar, Hash } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useDipaDokumen } from '@/features/anggaran/application/useDipaDokumen'
import type { DipaDokumenItem } from '@/features/anggaran/application/useDipaDokumen'
import { apiUrl } from '@/shared/api/httpClient'

const MONTHS = [
    { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' }, { value: 4, label: 'April' },
    { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' }, { value: 12, label: 'Desember' }
]
const YEARS = [2024, 2025, 2026, 2027]
const REVISIONS = Array.from({ length: 20 }, (_, i) => i + 1)

const fmt = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`
const fmtDate = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const monthLabel = (v: number) => MONTHS.find(m => m.value === v)?.label || String(v)

export default function AnggaranImportPage() {
    const canCreate = useAuthStore(s => s.user)?.Permissions?.includes('anggaran:create')

    // Filter
    const [tahun, setTahun] = useState(new Date().getFullYear())
    const [bulan, setBulan] = useState(new Date().getMonth() + 1)
    const [revisi, setRevisi] = useState(1)

    // Upload
    const [showUpload, setShowUpload] = useState(false)
    const [uploadFile, setUploadFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [uploadTahun, setUploadTahun] = useState(new Date().getFullYear())
    const [uploadBulan, setUploadBulan] = useState(new Date().getMonth() + 1)
    const [uploadRevisi, setUploadRevisi] = useState(1)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    // Modals
    const [deleteTarget, setDeleteTarget] = useState<DipaDokumenItem | null>(null)
    const [previewDoc, setPreviewDoc] = useState<DipaDokumenItem | null>(null)

    const { query, uploadMutation, deleteMutation } = useDipaDokumen({ tahun, bulan, revisi })
    const docs = query.data || []

    const pickFile = useCallback((file: File) => {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            setToast({ type: 'error', msg: 'Hanya file PDF yang diterima' }); return
        }
        setUploadFile(file)
        setToast(null)
    }, [])

    const handleUpload = async () => {
        if (!uploadFile) return
        try {
            await uploadMutation.mutateAsync({ file: uploadFile, tahun_anggaran: uploadTahun, bulan: uploadBulan, revisi: uploadRevisi })
            setToast({ type: 'success', msg: `"${uploadFile.name}" berhasil diunggah — ${monthLabel(uploadBulan)} ${uploadTahun} Rev ${uploadRevisi}` })
            setUploadFile(null)
            if (fileRef.current) fileRef.current.value = ''
        } catch (e) {
            setToast({ type: 'error', msg: e instanceof Error ? e.message : 'Gagal mengunggah' })
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        try { await deleteMutation.mutateAsync(deleteTarget.id); setDeleteTarget(null) }
        catch { /* noop */ }
    }

    if (!canCreate) return <div className="flex items-center justify-center py-20"><p className="text-slate-500">Anda tidak memiliki akses ke halaman ini.</p></div>

    return (
        <div className="space-y-5">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Dokumen DIPA / RKKS</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Kelola dokumen DIPA/RKKS dalam format PDF</p>
                </div>
                <button
                    onClick={() => setShowUpload(v => !v)}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${showUpload ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md'}`}
                >
                    {showUpload ? <ChevronUp size={16} /> : <Upload size={16} />}
                    {showUpload ? 'Tutup' : 'Upload Dokumen'}
                </button>
            </div>

            {/* ── Upload Panel (collapsible) ── */}
            {showUpload && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <div className="p-5">
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
                            {/* Drop zone */}
                            <div
                                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) pickFile(e.dataTransfer.files[0]) }}
                                onClick={() => fileRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] ${isDragging ? 'border-primary-400 bg-primary-50 scale-[1.01]' : uploadFile ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 hover:border-primary-300 hover:bg-primary-50/20'}`}
                            >
                                <input ref={fileRef} type="file" accept=".pdf" onChange={e => { if (e.target.files?.[0]) pickFile(e.target.files[0]) }} className="hidden" />
                                {uploadFile ? (
                                    <>
                                        <CheckCircle2 size={32} className="text-emerald-500 mb-2" />
                                        <p className="text-sm font-semibold text-emerald-700">{uploadFile.name}</p>
                                        <p className="text-xs text-emerald-500 mt-0.5">{fmt(uploadFile.size)} — klik untuk ganti</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-3 bg-slate-100 rounded-xl mb-3"><Upload size={24} className="text-slate-400" /></div>
                                        <p className="text-sm font-medium text-slate-600">Seret PDF ke sini atau klik untuk memilih</p>
                                    </>
                                )}
                            </div>

                            {/* Metadata + submit */}
                            <div className="flex flex-col gap-3">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Metadata</p>
                                <div className="space-y-2.5">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-slate-400 shrink-0" />
                                        <select value={uploadTahun} onChange={e => setUploadTahun(+e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-400 focus:border-primary-400">
                                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-slate-400 shrink-0" />
                                        <select value={uploadBulan} onChange={e => setUploadBulan(+e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-400 focus:border-primary-400">
                                            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Hash size={14} className="text-slate-400 shrink-0" />
                                        <select value={uploadRevisi} onChange={e => setUploadRevisi(+e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-400 focus:border-primary-400">
                                            {REVISIONS.map(r => <option key={r} value={r}>Revisi {r}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    onClick={handleUpload}
                                    disabled={!uploadFile || uploadMutation.isPending}
                                    className="mt-auto w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {uploadMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                    {uploadMutation.isPending ? 'Mengunggah...' : 'Unggah Dokumen'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast ── */}
            {toast && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                    <span className="flex-1">{toast.msg}</span>
                    <button onClick={() => setToast(null)} className="p-0.5 rounded hover:bg-black/5"><X size={14} /></button>
                </div>
            )}

            {/* ── Main Card: Filter + Table ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Inline filter toolbar */}
                <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Filter</span>
                    <select value={tahun} onChange={e => setTahun(+e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white font-medium focus:ring-2 focus:ring-primary-400">
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={bulan} onChange={e => setBulan(+e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white font-medium focus:ring-2 focus:ring-primary-400">
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <select value={revisi} onChange={e => setRevisi(+e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white font-medium focus:ring-2 focus:ring-primary-400">
                        {REVISIONS.map(r => <option key={r} value={r}>Rev {r}</option>)}
                    </select>
                    <div className="ml-auto flex items-center gap-2">
                        {!query.isLoading && <span className="text-xs text-slate-400 font-medium">{docs.length} dokumen</span>}
                    </div>
                </div>

                {/* Table */}
                {query.isLoading ? (
                    <div className="p-16 flex flex-col items-center text-slate-400">
                        <Loader2 size={24} className="animate-spin mb-2" />
                        <p className="text-sm">Memuat...</p>
                    </div>
                ) : docs.length === 0 ? (
                    <div className="p-16 flex flex-col items-center text-center">
                        <div className="p-4 bg-slate-100 rounded-2xl mb-3"><FileText size={28} className="text-slate-300" /></div>
                        <p className="text-sm font-medium text-slate-500">Belum ada dokumen</p>
                        <p className="text-xs text-slate-400 mt-1">Untuk {monthLabel(bulan)} {tahun} Revisi {revisi}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="px-5 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Nama File</th>
                                    <th className="px-5 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Periode</th>
                                    <th className="px-5 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Rev</th>
                                    <th className="px-5 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Upload</th>
                                    <th className="px-5 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Oleh</th>
                                    <th className="px-5 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-28"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {docs.map(doc => (
                                    <tr key={doc.id} className="group hover:bg-primary-50/30 transition-colors border-b border-slate-50 last:border-b-0">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-1.5 bg-red-50 rounded-lg group-hover:bg-red-100 transition-colors shrink-0"><FileText size={16} className="text-red-500" /></div>
                                                <span className="text-sm font-medium text-slate-800 truncate max-w-[260px]" title={doc.original_name}>{doc.original_name}</span>
                                                <span className="text-[10px] text-slate-400 shrink-0">{fmt(doc.file_size_bytes)}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3"><span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-100">{monthLabel(doc.bulan)} {doc.tahun_anggaran}</span></td>
                                        <td className="px-5 py-3"><span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{doc.revisi}</span></td>
                                        <td className="px-5 py-3 text-xs text-slate-500">{fmtDate(doc.created_at)}</td>
                                        <td className="px-5 py-3 text-xs text-slate-500">{doc.uploaded_by_name || '-'}</td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setPreviewDoc(doc)} title="Preview" className="p-1.5 rounded-lg text-primary-500 hover:bg-primary-50"><Eye size={15} /></button>
                                                <a href={apiUrl(`/documents/${doc.id}?download=true`)} title="Download" className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50"><Download size={15} /></a>
                                                <button onClick={() => setDeleteTarget(doc)} title="Hapus" className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Delete Modal ── */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-red-50 rounded-xl"><Trash2 size={20} className="text-red-500" /></div>
                            <div><h3 className="text-base font-bold text-slate-900">Hapus Dokumen?</h3><p className="text-xs text-slate-500">Tidak bisa dibatalkan</p></div>
                        </div>
                        <p className="text-sm font-medium text-slate-700 bg-slate-50 rounded-lg px-3 py-2 mb-5 truncate">{deleteTarget.original_name}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Batal</button>
                            <button onClick={handleDelete} disabled={deleteMutation.isPending} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                {deleteMutation.isPending ? 'Menghapus...' : 'Hapus'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Preview Modal ── */}
            {previewDoc && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPreviewDoc(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-1.5 bg-red-50 rounded-lg"><FileText size={18} className="text-red-500" /></div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">{previewDoc.original_name}</p>
                                    <p className="text-xs text-slate-500">{monthLabel(previewDoc.bulan)} {previewDoc.tahun_anggaran} • Rev {previewDoc.revisi}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <a href={apiUrl(`/documents/${previewDoc.id}?download=true`)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50">
                                    <Download size={13} /> Download
                                </a>
                                <button onClick={() => setPreviewDoc(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={18} className="text-slate-400" /></button>
                            </div>
                        </div>
                        <div className="flex-1 bg-slate-100 min-h-0">
                            <iframe src={apiUrl(`/documents/${previewDoc.id}`)} className="w-full h-full min-h-[70vh]" title={previewDoc.original_name} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
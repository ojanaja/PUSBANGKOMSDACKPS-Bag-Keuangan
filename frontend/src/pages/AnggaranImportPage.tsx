import { useState } from 'react'
import { Upload, Download, FileSpreadsheet, CheckCircle2 } from 'lucide-react'
import { useAnggaran } from '@/features/anggaran/application/useAnggaran'
import ImportPreviewModal from '@/features/anggaran/components/ImportPreviewModal'
import { useAuthStore } from '@/stores/authStore'

export default function AnggaranImportPage() {
    const currentUser = useAuthStore(s => s.user)
    const canCreate = currentUser?.Permissions?.includes('anggaran:create')
    
    const [showImportModal, setShowImportModal] = useState(false)
    const [tahun] = useState(new Date().getFullYear())
    const [lastImportResult, setLastImportResult] = useState<{ tahun: number } | null>(null)

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

            {showImportModal && (
                <ImportPreviewModal
                    onClose={() => setShowImportModal(false)}
                    onImported={(t) => {
                        setLastImportResult({ tahun: t })
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

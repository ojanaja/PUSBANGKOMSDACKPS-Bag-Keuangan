import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import PageHeader from '@/shared/ui/PageHeader'
import AppLoader from '@/shared/ui/AppLoader'
import AppTextButton from '@/shared/ui/AppTextButton'
import PromptDialog from '@/shared/ui/PromptDialog'
import { useProgres, type RealisasiFisik, type DocumentItem } from '@/features/progres/application/useProgres'
import { useToast } from '@/shared/hooks/useToast'
import PaketDetailTab from '@/features/progres/components/PaketDetailTab'
import ProgresTableTab from '@/features/progres/components/ProgresTableTab'
import DocumentsTab from '@/features/progres/components/DocumentsTab'
import DocumentPreviewModal from '@/features/progres/components/DocumentPreviewModal'

const tabs = ['Rincian Proyek', 'Progres Lapangan', 'Manajemen Dokumen']

export default function ProgresPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const user = useAuthStore(s => s.user)
    const isAdmin = user?.Role === 'SUPER_ADMIN' || user?.Role === 'ADMIN_KEUANGAN'

    const [activeTab, setActiveTab] = useState(1)
    const [uploading, setUploading] = useState<{ bulan: number, kategori: string, progress?: string } | null>(null)
    const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null)
    const [saving, setSaving] = useState<number | null>(null)
    const [rejectPrompt, setRejectPrompt] = useState<{ idRecord: string, type: 'realisasi' | 'document' } | null>(null)
    const { showToast } = useToast()

    const { detailQuery, documentsQuery, saveRealisasiMutation, uploadDocumentMutation, verifyMutation } = useProgres(id)

    const loading = detailQuery.isLoading || documentsQuery.isLoading
    const error = detailQuery.error instanceof Error ? detailQuery.error.message : null

    const paket = detailQuery.data?.paket || null
    const targets = detailQuery.data?.targets || []

    const [realisasi, setRealisasi] = useState<RealisasiFisik[]>(Array.from({ length: 12 }, (_, i) => ({
        Bulan: i + 1,
        PersenAktual: 0,
        CatatanKendala: ''
    })))

    useEffect(() => {
        if (detailQuery.data?.realisasi) {
            setRealisasi(detailQuery.data.realisasi)
        }
    }, [detailQuery.data?.realisasi])

    const documents = documentsQuery.data || {}

    const handleUpload = async (bulan: number, kategori: string, files: File[]) => {
        if (!files || files.length === 0) return

        setUploading({ bulan, kategori, progress: `0/${files.length}` })

        try {
            await uploadDocumentMutation.mutateAsync({
                paketId: id!,
                bulan: bulan + 1,
                kategori,
                files,
                onProgress: (progress) => setUploading({ bulan, kategori, progress }),
            })
        } catch (e) {
            showToast(`Gagal unggah: ${e instanceof Error ? e.message : 'Kesalahan tidak diketahui'}`, 'error')
        } finally {
            setUploading(null)
        }
    }

    const handleSaveRealisasi = async (index: number) => {
        setSaving(index)
        const item = realisasi[index]
        try {
            await saveRealisasiMutation.mutateAsync(item)
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Gagal menyimpan', 'error')
        } finally {
            setSaving(null)
        }
    }

    const handleRealisasiChange = (index: number, field: 'PersenAktual' | 'CatatanKendala', value: string | number) => {
        const next = [...realisasi]
        next[index] = { ...next[index], [field]: value }
        setRealisasi(next)
    }

    const handleVerify = async (idRecord: string, type: 'realisasi' | 'document', status: 'APPROVED' | 'REJECTED', reason?: string) => {
        try {
            await verifyMutation.mutateAsync({ idRecord, type, status, reason })
            showToast(`Berhasil: ${status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}`, 'success')
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Gagal memproses', 'error')
        }
    }

    if (loading) return <AppLoader label="Memuat detail paket..." />

    if (error || !paket) return (
        <div className="flex flex-col items-center justify-center py-40 gap-4 text-center">
            <AlertCircle size={48} className="text-red-400" />
            <p className="text-slate-800 font-bold text-xl">{error || 'Paket tidak ditemukan'}</p>
            <AppTextButton label="Kembali ke Progres Satker" onClick={() => navigate('/progres-satker')} />
        </div>
    )

    return (
        <div className="space-y-6">
            <PageHeader
                title={paket.NamaPaket}
                description={`${paket.Kasatker} • ${paket.Lokasi}`}
                actions={(
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${paket.Status === 'AKTIF' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {paket.Status}
                    </span>
                )}
            />

            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit shadow-sm border border-slate-200">
                {tabs.map((tab, i) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(i)}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === i
                            ? 'bg-white text-primary-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {activeTab === 0 && <PaketDetailTab paket={paket} />}

                {activeTab === 1 && (
                    <ProgresTableTab
                        targets={targets}
                        realisasi={realisasi}
                        isAdmin={!!isAdmin}
                        saving={saving}
                        onRealisasiChange={handleRealisasiChange}
                        onSave={handleSaveRealisasi}
                        onApprove={(idRecord) => handleVerify(idRecord, 'realisasi', 'APPROVED')}
                        onReject={(idRecord) => setRejectPrompt({ idRecord, type: 'realisasi' })}
                    />
                )}

                {activeTab === 2 && (
                    <DocumentsTab
                        documents={documents}
                        isAdmin={!!isAdmin}
                        uploading={uploading}
                        onUpload={handleUpload}
                        onPreview={setPreviewDoc}
                        onApprove={(docId) => handleVerify(docId, 'document', 'APPROVED')}
                        onReject={(docId) => setRejectPrompt({ idRecord: docId, type: 'document' })}
                    />
                )}
            </div>

            {previewDoc && (
                <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
            )}

            <PromptDialog
                open={rejectPrompt !== null}
                title="Tolak Item"
                label="Alasan penolakan:"
                placeholder="Tuliskan alasan penolakan..."
                submitLabel="Tolak"
                onSubmit={(reason) => {
                    if (rejectPrompt) {
                        handleVerify(rejectPrompt.idRecord, rejectPrompt.type, 'REJECTED', reason)
                    }
                    setRejectPrompt(null)
                }}
                onCancel={() => setRejectPrompt(null)}
            />
        </div>
    )
}

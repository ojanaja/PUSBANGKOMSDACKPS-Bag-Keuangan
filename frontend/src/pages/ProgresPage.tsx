import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Upload, FileText, ChevronDown, ChevronRight, Loader2, AlertCircle, Save, ExternalLink, CheckCircle, XCircle, ShieldCheck, ShieldX, Eye, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { processImageFile } from '@/lib/fileUtils'
import { useDropzone, type DropzoneOptions } from 'react-dropzone'
import PageHeader from '@/shared/ui/PageHeader'
import AppLoader from '@/shared/ui/AppLoader'
import AppTextButton from '@/shared/ui/AppTextButton'

const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const tabs = ['Rincian Proyek', 'Progres Lapangan', 'Manajemen Dokumen']

const financialDocumentAccept: DropzoneOptions['accept'] = {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'text/csv': ['.csv']
}

function FileDropzone({ onDrop, accept, uploading, label, type, empty }: { onDrop: (files: File[]) => void, accept?: DropzoneOptions['accept'], uploading?: { progress?: string }, label: string, type: 'document' | 'image', empty?: boolean }) {
    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept,
        disabled: !!uploading,
        noClick: true
    })

    if (empty) {
        return (
            <div {...getRootProps()} className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-primary-300'}`}>
                <input {...getInputProps()} />
                {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-primary-600">
                        <Loader2 size={24} className="animate-spin" />
                        <span className="text-xs font-bold">Mengunggah {uploading.progress}</span>
                    </div>
                ) : (
                    <>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-colors ${isDragActive ? 'bg-primary-100 text-primary-600' : 'bg-white text-slate-400 shadow-sm border border-slate-100'}`}>
                            {isDragActive ? <Upload size={20} /> : (type === 'document' ? <FileText size={20} /> : <Upload size={20} />)}
                        </div>
                        <p className="text-sm font-medium text-slate-700">{isDragActive ? 'Lepaskan file di sini' : label}</p>
                        <p className="text-xs text-slate-400 mt-1 mb-3">{type === 'document' ? 'Tarik & Letakkan dokumen di sini (PDF/Word/Excel/PPT/CSV, Max 500MB)' : 'Tarik & Letakkan foto di sini (JPG/PNG)'}</p>
                        <button
                            type="button"
                            onClick={open}
                            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-200"
                        >
                            Pilih File
                        </button>
                    </>
                )}
            </div>
        )
    }

    return (
        <div {...getRootProps()} onClick={open} className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-primary-600 hover:border-primary-300 hover:shadow-sm transition-all uppercase tracking-wide cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <input {...getInputProps()} />
            {uploading ? (
                <>
                    <Loader2 size={14} className="animate-spin" />
                    Mengunggah {uploading.progress || '...'}
                </>
            ) : (
                <>
                    {isDragActive ? <Upload size={14} className="animate-bounce" /> : <Upload size={14} />}
                    {isDragActive ? 'Lepaskan di sini' : label}
                </>
            )}
        </div>
    )
}

interface PaketDetail {
    ID: string
    NamaPaket: string
    Kasatker: string
    Lokasi: string
    PaguPaket: number
    Status: string
}

interface Target {
    Bulan: number
    PersenKeuangan: number
    PersenFisik: number
}

interface RealisasiFisik {
    ID?: string
    Bulan: number
    PersenAktual: number
    CatatanKendala: string
    VerificationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'
    VerifiedByFullName?: string
    RejectionReason?: string
}

const verificationLabel: Record<'APPROVED' | 'REJECTED' | 'PENDING', string> = {
    APPROVED: 'Disetujui',
    REJECTED: 'Ditolak',
    PENDING: 'Menunggu'
}

function getVerificationLabel(status?: string) {
    if (status === 'APPROVED' || status === 'REJECTED' || status === 'PENDING') {
        return verificationLabel[status]
    }
    return 'Menunggu'
}

function formatCurrency(v: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)
}

export default function ProgresPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const user = useAuthStore(s => s.user)
    const isAdmin = user?.Role === 'SUPER_ADMIN' || user?.Role === 'ADMIN_KEUANGAN'

    const [activeTab, setActiveTab] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [paket, setPaket] = useState<PaketDetail | null>(null)
    const [targets, setTargets] = useState<Target[]>([])
    const [realisasi, setRealisasi] = useState<RealisasiFisik[]>(Array.from({ length: 12 }, (_, i) => ({
        Bulan: i + 1,
        PersenAktual: 0,
        CatatanKendala: ''
    })))
    const [documents, setDocuments] = useState<Record<number, any[]>>({})
    const [uploading, setUploading] = useState<{ bulan: number, kategori: string, progress?: string } | null>(null)

    const [expandedMonth, setExpandedMonth] = useState<number | null>(new Date().getMonth())
    const [saving, setSaving] = useState<number | null>(null)
    const [previewDoc, setPreviewDoc] = useState<any>(null)

    useEffect(() => {
        if (id) fetchDetail()
    }, [id])

    useEffect(() => {
        if (id && paket) {
            fetchDocuments()
        }
    }, [id, paket])

    useEffect(() => {
        if (id && expandedMonth !== null) {
            fetchDocuments(expandedMonth + 1)
        }
    }, [id, expandedMonth])

    const fetchDetail = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/v1/paket/${id}`, { credentials: 'include' })
            if (!res.ok) throw new Error('Paket tidak ditemukan')
            const data = await res.json()

            setPaket(data.paket || data)
            if (data.targets) setTargets(data.targets)
            if (data.realisasi) {
                const newRealisasi = [...realisasi]
                data.realisasi.forEach((r: any) => {
                    newRealisasi[r.Bulan - 1] = {
                        ID: r.ID,
                        Bulan: r.Bulan,
                        PersenAktual: r.PersenAktual,
                        CatatanKendala: r.CatatanKendala || '',
                        VerificationStatus: r.VerificationStatus || 'PENDING',
                        VerifiedByFullName: r.VerifiedByFullName,
                        RejectionReason: r.RejectionReason
                    }
                })
                setRealisasi(newRealisasi)
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Terjadi kesalahan')
        } finally {
            setLoading(false)
        }
    }

    const fetchDocuments = async (bulan?: number) => {
        try {
            const url = bulan
                ? `/api/v1/paket/${id}/documents?bulan=${bulan}`
                : `/api/v1/paket/${id}/documents`

            const res = await fetch(url, { credentials: 'include' })
            if (!res.ok) throw new Error('Gagal mengambil dokumen')
            const data = await res.json()

            if (bulan) {
                setDocuments(prev => ({ ...prev, [bulan - 1]: data || [] }))
            } else {
                const newDocs: Record<number, any[]> = {}
                if (Array.isArray(data)) {
                    data.forEach((d: any) => {
                        const m = d.Bulan - 1
                        if (!newDocs[m]) newDocs[m] = []
                        newDocs[m].push(d)
                    })
                }
                setDocuments(newDocs)
            }
        } catch (e) {
            console.error(e)
        }
    }

    const handleUpload = async (bulan: number, kategori: string, fileList: FileList | File[]) => {
        if (!fileList || fileList.length === 0) return

        const files = Array.from(fileList as ArrayLike<File>)
        setUploading({ bulan, kategori, progress: `0/${files.length}` })

        for (let i = 0; i < files.length; i++) {
            let file = files[i]
            setUploading({ bulan, kategori, progress: `${i + 1}/${files.length}` })

            try {
                if (file.type.startsWith('image/')) {
                    file = await processImageFile(file)
                }

                const formData = new FormData()
                formData.append('file', file)
                formData.append('paket_id', id!)
                formData.append('bulan', String(bulan + 1))
                formData.append('kategori', kategori)
                formData.append('jenis_dokumen', kategori === 'FISIK' ? 'FOTO' : 'DOKUMEN')

                const res = await fetch('/api/v1/documents', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                })
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}))
                    throw new Error(errData.message || 'Gagal upload file')
                }

            } catch (e) {
                console.error(`Gagal unggah untuk ${file.name}:`, e)
                alert(`Gagal unggah ${file.name}: ${e instanceof Error ? e.message : 'Kesalahan tidak diketahui'}`)
            }
        }

        fetchDocuments(bulan + 1)
        setUploading(null)
    }

    const handleSaveRealisasi = async (index: number) => {
        setSaving(index)
        const item = realisasi[index]
        try {
            const res = await fetch(`/api/v1/paket/${id}/realisasi`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bulan: item.Bulan,
                    persen_aktual: item.PersenAktual,
                    catatan_kendala: item.CatatanKendala
                }),
                credentials: 'include'
            })
            if (!res.ok) throw new Error('Gagal menyimpan progres')
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Gagal menyimpan')
        } finally {
            setSaving(null)
        }
    }

    const handleVerify = async (idRecord: string, type: 'realisasi' | 'document', status: 'APPROVED' | 'REJECTED', reason?: string) => {
        try {
            const res = await fetch(`/api/v1/verification/${type}/${idRecord}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, rejection_reason: reason }),
                credentials: 'include'
            })
            if (!res.ok) throw new Error('Gagal memproses verifikasi')

            if (type === 'realisasi') fetchDetail()
            else fetchDocuments(expandedMonth! + 1)

            alert(`Berhasil: ${status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}`)
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Gagal memproses')
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
                {activeTab === 0 && (
                    <div className="p-8 max-w-4xl">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-primary-500 rounded-full" />
                            Informasi Detail Paket
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                            {[
                                { label: 'Nama Paket Pekerjaan', value: paket.NamaPaket },
                                { label: 'Kasatker / Pejabat Pembuat Komitmen', value: paket.Kasatker },
                                { label: 'Lokasi Proyek', value: paket.Lokasi },
                                { label: 'Total Pagu DIPA', value: formatCurrency(paket.PaguPaket) },
                                { label: 'ID Paket', value: paket.ID, mono: true },
                            ].map(({ label, value, mono }) => (
                                <div key={label} className="space-y-1">
                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{label}</span>
                                    <p className={`text-slate-800 font-medium ${mono ? 'font-mono text-sm' : 'text-base'}`}>{value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 1 && (
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-primary-500 rounded-full" />
                                Monitoring Progres Fisik Bulanan
                            </h2>
                            <p className="text-xs text-slate-400">Target otomatis bersumber dari rencana kerja paket</p>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-left text-slate-500 font-bold border-b border-slate-100">
                                        <th className="px-6 py-4">Bulan Operasional</th>
                                        <th className="px-6 py-4 text-center">Target Fisik (%)</th>
                                        <th className="px-6 py-4 text-center">Realisasi Aktual (%)</th>
                                        <th className="px-6 py-4">Catatan Kendala</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {months.map((month, i) => {
                                        const target = targets.find(t => t.Bulan === i + 1)?.PersenFisik || 0
                                        const rec = realisasi[i]
                                        const actual = rec?.PersenAktual || 0
                                        const deviasi = actual - target

                                        return (
                                            <tr key={month} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-slate-700">{month}</p>
                                                    {rec?.VerificationStatus && rec.VerificationStatus !== 'PENDING' && (
                                                        <div className={`mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${rec.VerificationStatus === 'APPROVED' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {rec.VerificationStatus === 'APPROVED' ? <ShieldCheck size={12} /> : <ShieldX size={12} />}
                                                            {verificationLabel[rec.VerificationStatus]} oleh {rec.VerifiedByFullName}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center font-medium text-slate-600 bg-slate-50/50">{target}%</td>
                                                <td className="px-6 py-4 text-center">
                                                    <input
                                                        type="number"
                                                        min={0} max={100}
                                                        value={actual || ''}
                                                        disabled={rec?.VerificationStatus === 'APPROVED' && !isAdmin}
                                                        onChange={(e) => {
                                                            const next = [...realisasi]
                                                            next[i] = { ...next[i], PersenAktual: Number(e.target.value) || 0 }
                                                            setRealisasi(next)
                                                        }}
                                                        className={`w-20 text-center px-2 py-1.5 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all ${deviasi < 0 && actual > 0 ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-300'
                                                            }`}
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="text"
                                                        placeholder="Opsional..."
                                                        value={realisasi[i]?.CatatanKendala || ''}
                                                        onChange={(e) => {
                                                            const next = [...realisasi]
                                                            next[i] = { ...next[i], CatatanKendala: e.target.value }
                                                            setRealisasi(next)
                                                        }}
                                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handleSaveRealisasi(i)}
                                                            disabled={saving === i || (rec?.VerificationStatus === 'APPROVED' && !isAdmin)}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${saving === i
                                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200'
                                                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                            title="Simpan Progres"
                                                        >
                                                            {saving === i ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                            <span>Simpan</span>
                                                        </button>

                                                        {isAdmin && rec?.ID && rec.VerificationStatus === 'PENDING' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleVerify(rec.ID!, 'realisasi', 'APPROVED')}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-medium transition-colors border border-emerald-200"
                                                                    title="Setujui Progres"
                                                                >
                                                                    <CheckCircle size={14} />
                                                                    <span>Setuju</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        const reason = prompt('Alasan penolakan:')
                                                                        if (reason) handleVerify(rec.ID!, 'realisasi', 'REJECTED', reason)
                                                                    }}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors border border-red-200"
                                                                    title="Tolak Progres"
                                                                >
                                                                    <XCircle size={14} />
                                                                    <span>Tolak</span>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 2 && (
                    <div className="p-8 space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-primary-500 rounded-full" />
                                Manajemen Dokumen Bukti Per Bulan
                            </h2>
                            <p className="text-sm text-slate-500">Pilih bulan untuk melihat atau mengunggah dokumen baru</p>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {months.map((month, i) => (
                                <div key={month} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <button
                                        onClick={() => setExpandedMonth(expandedMonth === i ? null : i)}
                                        className={`w-full flex items-center justify-between px-6 py-4 transition-all ${expandedMonth === i ? 'bg-primary-50' : 'bg-white hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`text-sm font-bold ${expandedMonth === i ? 'text-primary-700' : 'text-slate-700'}`}>
                                                {month}
                                            </span>
                                            {expandedMonth === i && <span className="w-1 h-1 bg-primary-400 rounded-full" />}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {(() => {
                                                const keuDocs = (documents[i] || []).filter(d => d.kategori === 'KEUANGAN' || d.Kategori === 'KEUANGAN').length
                                                const fisDocs = (documents[i] || []).filter(d => d.kategori === 'FISIK' || d.Kategori === 'FISIK').length
                                                return (
                                                    <>
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${keuDocs > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                                            📄 Keuangan: {keuDocs}
                                                        </span>
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${fisDocs > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                                            📷 Fisik: {fisDocs}
                                                        </span>
                                                    </>
                                                )
                                            })()}
                                            {expandedMonth === i ? <ChevronDown size={18} className="text-primary-600" /> : <ChevronRight size={18} className="text-slate-300" />}
                                        </div>
                                    </button>

                                    {expandedMonth === i && (
                                        <div className="p-6 bg-white border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dokumen Keuangan</h4>
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">PDF / Word / Excel / PPT / CSV</span>
                                                    </div>

                                                    {(documents[i] || []).filter(d => d.kategori === 'KEUANGAN' || d.Kategori === 'KEUANGAN').length > 0 ? (
                                                        <div className="space-y-2">
                                                            {(documents[i] || []).filter(d => d.kategori === 'KEUANGAN' || d.Kategori === 'KEUANGAN').map(doc => (
                                                                <div key={doc.id || doc.ID} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                                                                    <div className="flex items-center gap-3">
                                                                        <FileText size={18} className="text-red-500" />
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm font-semibold text-slate-700 truncate">{doc.original_name || doc.OriginalName}</p>
                                                                            <p className="text-[10px] text-slate-400 font-medium">{((doc.file_size_bytes || doc.FileSizeBytes) / 1024).toFixed(1)} KB</p>
                                                                        </div>
                                                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                                                            <button
                                                                                onClick={() => setPreviewDoc(doc)}
                                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-xs font-bold transition-all border border-sky-100"
                                                                                title="Lihat Dokumen"
                                                                            >
                                                                                <Eye size={14} />
                                                                                Lihat
                                                                            </button>
                                                                            <a
                                                                                href={`/api/v1/documents/${doc.id || doc.ID}?download=true`}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-all border border-indigo-100"
                                                                                title="Unduh Dokumen"
                                                                            >
                                                                                <ExternalLink size={14} />
                                                                                Unduh
                                                                            </a>
                                                                            {isAdmin && (doc.verification_status || doc.VerificationStatus) === 'PENDING' && (
                                                                                <>
                                                                                    <button
                                                                                        onClick={() => handleVerify(doc.id || doc.ID, 'document', 'APPROVED')}
                                                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-all border border-emerald-100"
                                                                                        title="Setujui Dokumen"
                                                                                    >
                                                                                        <CheckCircle size={14} />
                                                                                        Setuju
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const reason = prompt('Alasan penolakan:')
                                                                                            if (reason) handleVerify(doc.id || doc.ID, 'document', 'REJECTED', reason)
                                                                                        }}
                                                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-bold transition-all border border-red-100"
                                                                                        title="Tolak Dokumen"
                                                                                    >
                                                                                        <XCircle size={14} />
                                                                                        Tolak
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {(doc.verification_status || doc.VerificationStatus) && (doc.verification_status !== 'PENDING' && doc.VerificationStatus !== 'PENDING') && (
                                                                        <div className={`mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${(doc.verification_status || doc.VerificationStatus) === 'APPROVED' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                            {(doc.verification_status || doc.VerificationStatus) === 'APPROVED' ? <ShieldCheck size={12} /> : <ShieldX size={12} />}
                                                                            {getVerificationLabel(doc.verification_status || doc.VerificationStatus)} oleh {doc.verified_by_full_name || doc.VerifiedByFullName}
                                                                            {(doc.rejection_reason || doc.RejectionReason) && <span className="text-slate-400 font-normal normal-case ml-1">— {doc.rejection_reason || doc.RejectionReason}</span>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            <FileDropzone
                                                                label="Unggah File Lain"
                                                                type="document"
                                                                accept={financialDocumentAccept}
                                                                onDrop={(files) => handleUpload(i, 'KEUANGAN', files)}
                                                                uploading={uploading?.bulan === i && uploading?.kategori === 'KEUANGAN' ? uploading : undefined}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <FileDropzone
                                                            empty
                                                            label="Tarik Dokumen Keuangan ke Sini"
                                                            type="document"
                                                            accept={financialDocumentAccept}
                                                            onDrop={(files) => handleUpload(i, 'KEUANGAN', files)}
                                                            uploading={uploading?.bulan === i && uploading?.kategori === 'KEUANGAN' ? uploading : undefined}
                                                        />
                                                    )}
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dokumen Fisik / Lapangan</h4>
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">Gambar JPG / PNG</span>
                                                    </div>

                                                    {(documents[i] || []).filter(d => d.kategori === 'FISIK' || d.Kategori === 'FISIK').length > 0 ? (
                                                        <div className="space-y-3">
                                                            <div className="grid grid-cols-2 gap-4">
                                                                {(documents[i] || []).filter(d => d.kategori === 'FISIK' || d.Kategori === 'FISIK').map(doc => (
                                                                    <div key={doc.id || doc.ID} className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                                                        <div className="aspect-video w-full bg-slate-100 relative group cursor-pointer" onClick={() => setPreviewDoc(doc)}>
                                                                            <img
                                                                                src={`/api/v1/documents/${doc.id || doc.ID}`}
                                                                                alt={doc.original_name || doc.OriginalName}
                                                                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                                            />
                                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                                                <Eye className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md" size={32} />
                                                                            </div>
                                                                            {(doc.verification_status || doc.VerificationStatus) && (doc.verification_status !== 'PENDING' && doc.VerificationStatus !== 'PENDING') && (
                                                                                <div className={`absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${(doc.verification_status || doc.VerificationStatus) === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                                                                    {(doc.verification_status || doc.VerificationStatus) === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        <div className="p-3">
                                                                            <p className="text-xs font-bold text-slate-700 truncate mb-3" title={doc.original_name || doc.OriginalName}>
                                                                                {doc.original_name || doc.OriginalName}
                                                                            </p>

                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                <button
                                                                                    onClick={() => setPreviewDoc(doc)}
                                                                                    className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-[10px] font-bold transition-all border border-sky-100"
                                                                                >
                                                                                    <Eye size={12} />
                                                                                    Lihat
                                                                                </button>

                                                                                {isAdmin && (doc.verification_status || doc.VerificationStatus) === 'PENDING' ? (
                                                                                    <>
                                                                                        <button
                                                                                            onClick={() => handleVerify(doc.id || doc.ID, 'document', 'APPROVED')}
                                                                                            className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold transition-all border border-emerald-100"
                                                                                        >
                                                                                            <CheckCircle size={12} />
                                                                                            Setuju
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                const reason = prompt('Alasan penolakan:')
                                                                                                if (reason) handleVerify(doc.id || doc.ID, 'document', 'REJECTED', reason)
                                                                                            }}
                                                                                            className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-[10px] font-bold transition-all border border-red-100 col-span-2"
                                                                                        >
                                                                                            <XCircle size={12} />
                                                                                            Tolak
                                                                                        </button>
                                                                                    </>
                                                                                ) : (
                                                                                    <a
                                                                                        href={`/api/v1/documents/${doc.id || doc.ID}?download=true`}
                                                                                        target="_blank"
                                                                                        rel="noreferrer"
                                                                                        className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[10px] font-bold transition-all border border-indigo-100"
                                                                                    >
                                                                                        <ExternalLink size={12} />
                                                                                        Unduh
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <FileDropzone
                                                                label="Ambil Foto Lain"
                                                                type="image"
                                                                accept={{ 'image/*': [] }}
                                                                onDrop={(files) => handleUpload(i, 'FISIK', files)}
                                                                uploading={uploading?.bulan === i && uploading?.kategori === 'FISIK' ? uploading : undefined}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <FileDropzone
                                                            empty
                                                            label="Tarik Foto Progres ke Sini"
                                                            type="image"
                                                            accept={{ 'image/*': [] }}
                                                            onDrop={(files) => handleUpload(i, 'FISIK', files)}
                                                            uploading={uploading?.bulan === i && uploading?.kategori === 'FISIK' ? uploading : undefined}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {previewDoc && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col relative overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">{previewDoc.OriginalName}</h3>
                                <p className="text-sm text-slate-500">
                                    {(previewDoc.FileSizeBytes / 1024).toFixed(1)} KB • {previewDoc.MimeType}
                                </p>
                            </div>
                            <button
                                onClick={() => setPreviewDoc(null)}
                                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-auto p-4">
                            {previewDoc.MimeType.startsWith('image/') ? (
                                <img
                                    src={`/api/v1/documents/${previewDoc.ID}?t=${Date.now()}`}
                                    alt={previewDoc.OriginalName}
                                    className="max-w-full max-h-full object-contain shadow-lg rounded"
                                />
                            ) : previewDoc.MimeType === 'application/pdf' ? (
                                <iframe
                                    src={`/api/v1/documents/${previewDoc.ID}?t=${Date.now()}`}
                                    className="w-full h-full shadow-lg rounded bg-white"
                                    title={previewDoc.OriginalName}
                                />
                            ) : (
                                <div className="text-center p-8 bg-white rounded-xl shadow-sm">
                                    <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                                    <p className="font-medium text-slate-800">Pratinjau tidak tersedia</p>
                                    <p className="text-sm text-slate-500 mb-4">Silakan unduh file untuk melihat isinya</p>
                                    <a
                                        href={`/api/v1/documents/${previewDoc.ID}?download=true`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                                    >
                                        <ExternalLink size={16} />
                                        Unduh File
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

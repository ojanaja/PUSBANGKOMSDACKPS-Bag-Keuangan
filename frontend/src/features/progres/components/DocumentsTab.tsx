import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, ExternalLink, Eye, CheckCircle, XCircle, ShieldCheck, ShieldX } from 'lucide-react'
import { apiUrl } from '@/shared/api/httpClient'
import type { DocumentItem } from '@/features/progres/application/useProgres'
import FileDropzone, { type AcceptMap } from './FileDropzone'
import { MONTHS_LONG } from '@/shared/config/months'

const months = MONTHS_LONG

const financialDocumentAccept: AcceptMap = {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'text/csv': ['.csv']
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

interface DocumentsTabProps {
    documents: Record<number, DocumentItem[]>
    isAdmin: boolean
    uploading: { bulan: number; kategori: string; progress?: string } | null
    onUpload: (bulan: number, kategori: string, files: File[]) => void
    onPreview: (doc: DocumentItem) => void
    onApprove: (docId: string) => void
    onReject: (docId: string) => void
}

export default function DocumentsTab({
    documents,
    isAdmin,
    uploading,
    onUpload,
    onPreview,
    onApprove,
    onReject,
}: DocumentsTabProps) {
    const [expandedMonth, setExpandedMonth] = useState<number | null>(new Date().getMonth())

    return (
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
                            className={`w-full flex items-center justify-between px-6 py-4 transition-all ${expandedMonth === i ? 'bg-primary-50' : 'bg-white hover:bg-slate-50'}`}
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
                                                Keuangan: {keuDocs}
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${fisDocs > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                                Fisik: {fisDocs}
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
                                    <FinancialDocsSection
                                        docs={(documents[i] || []).filter(d => d.kategori === 'KEUANGAN' || d.Kategori === 'KEUANGAN')}
                                        monthIndex={i}
                                        isAdmin={isAdmin}
                                        uploading={uploading?.bulan === i && uploading?.kategori === 'KEUANGAN' ? uploading : undefined}
                                        onUpload={(files) => onUpload(i, 'KEUANGAN', files)}
                                        onPreview={onPreview}
                                        onApprove={onApprove}
                                        onReject={onReject}
                                    />
                                    <PhysicalDocsSection
                                        docs={(documents[i] || []).filter(d => d.kategori === 'FISIK' || d.Kategori === 'FISIK')}
                                        monthIndex={i}
                                        isAdmin={isAdmin}
                                        uploading={uploading?.bulan === i && uploading?.kategori === 'FISIK' ? uploading : undefined}
                                        onUpload={(files) => onUpload(i, 'FISIK', files)}
                                        onPreview={onPreview}
                                        onApprove={onApprove}
                                        onReject={onReject}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}


interface DocSectionProps {
    docs: DocumentItem[]
    monthIndex: number
    isAdmin: boolean
    uploading?: { progress?: string }
    onUpload: (files: File[]) => void
    onPreview: (doc: DocumentItem) => void
    onApprove: (docId: string) => void
    onReject: (docId: string) => void
}

function FinancialDocsSection({ docs, uploading, onUpload, onPreview, isAdmin, onApprove, onReject }: DocSectionProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dokumen Keuangan</h4>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">PDF / Word / Excel / PPT / CSV</span>
            </div>

            {docs.length > 0 ? (
                <div className="space-y-2">
                    {docs.map(doc => (
                        <div key={doc.id || doc.ID} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                            <div className="flex items-center gap-3">
                                <FileText size={18} className="text-red-500" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-700 truncate">{doc.original_name || doc.OriginalName}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{((doc.file_size_bytes || doc.FileSizeBytes || 0) / 1024).toFixed(1)} KB</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <button onClick={() => onPreview(doc)} className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-xs font-bold transition-all border border-sky-100" title="Lihat Dokumen">
                                        <Eye size={14} /> Lihat
                                    </button>
                                    <a href={apiUrl(`/documents/${doc.id || doc.ID}?download=true`)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-all border border-indigo-100" title="Unduh Dokumen">
                                        <ExternalLink size={14} /> Unduh
                                    </a>
                                    {isAdmin && (doc.verification_status || doc.VerificationStatus) === 'PENDING' && (
                                        <>
                                            <button onClick={() => onApprove(doc.id || doc.ID)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-all border border-emerald-100" title="Setujui Dokumen">
                                                <CheckCircle size={14} /> Setuju
                                            </button>
                                            <button onClick={() => onReject(doc.id || doc.ID)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-bold transition-all border border-red-100" title="Tolak Dokumen">
                                                <XCircle size={14} /> Tolak
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <VerificationBadge doc={doc} />
                        </div>
                    ))}
                    <FileDropzone label="Unggah File Lain" type="document" accept={financialDocumentAccept} onDrop={onUpload} uploading={uploading} />
                </div>
            ) : (
                <FileDropzone empty label="Tarik Dokumen Keuangan ke Sini" type="document" accept={financialDocumentAccept} onDrop={onUpload} uploading={uploading} />
            )}
        </div>
    )
}

function PhysicalDocsSection({ docs, uploading, onUpload, onPreview, isAdmin, onApprove, onReject }: DocSectionProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dokumen Fisik / Lapangan</h4>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">Gambar JPG / PNG</span>
            </div>

            {docs.length > 0 ? (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                        {docs.map(doc => (
                            <div key={doc.id || doc.ID} className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                <div className="aspect-video w-full bg-slate-100 relative group cursor-pointer" onClick={() => onPreview(doc)}>
                                    <img
                                        src={apiUrl(`/documents/${doc.id || doc.ID}`)}
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
                                        <button onClick={() => onPreview(doc)} className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-[10px] font-bold transition-all border border-sky-100">
                                            <Eye size={12} /> Lihat
                                        </button>
                                        {isAdmin && (doc.verification_status || doc.VerificationStatus) === 'PENDING' ? (
                                            <>
                                                <button onClick={() => onApprove(doc.id || doc.ID)} className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold transition-all border border-emerald-100">
                                                    <CheckCircle size={12} /> Setuju
                                                </button>
                                                <button onClick={() => onReject(doc.id || doc.ID)} className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-[10px] font-bold transition-all border border-red-100 col-span-2">
                                                    <XCircle size={12} /> Tolak
                                                </button>
                                            </>
                                        ) : (
                                            <a href={apiUrl(`/documents/${doc.id || doc.ID}?download=true`)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[10px] font-bold transition-all border border-indigo-100">
                                                <ExternalLink size={12} /> Unduh
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <FileDropzone label="Ambil Foto Lain" type="image" accept={{ 'image/*': [] }} onDrop={onUpload} uploading={uploading} />
                </div>
            ) : (
                <FileDropzone empty label="Tarik Foto Progres ke Sini" type="image" accept={{ 'image/*': [] }} onDrop={onUpload} uploading={uploading} />
            )}
        </div>
    )
}

function VerificationBadge({ doc }: { doc: DocumentItem }) {
    const vs = doc.verification_status || doc.VerificationStatus
    if (!vs || vs === 'PENDING') return null

    return (
        <div className={`mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${vs === 'APPROVED' ? 'text-emerald-600' : 'text-red-600'}`}>
            {vs === 'APPROVED' ? <ShieldCheck size={12} /> : <ShieldX size={12} />}
            {getVerificationLabel(vs)} oleh {doc.verified_by_full_name || doc.VerifiedByFullName}
            {(doc.rejection_reason || doc.RejectionReason) && <span className="text-slate-400 font-normal normal-case ml-1">— {doc.rejection_reason || doc.RejectionReason}</span>}
        </div>
    )
}

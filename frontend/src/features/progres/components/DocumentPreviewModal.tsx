import { X, FileText, ExternalLink } from 'lucide-react'
import { apiUrl } from '@/shared/api/httpClient'
import type { DocumentItem } from '@/features/progres/application/useProgres'

interface DocumentPreviewModalProps {
    doc: DocumentItem
    onClose: () => void
}

function effectiveMime(mime: string, name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    const extMap: Record<string, string> = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        csv: 'text/csv',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
    }
    if (
        ext in extMap &&
        (mime === 'application/zip' || mime === 'application/octet-stream' || mime === '')
    ) {
        return extMap[ext]
    }
    return mime || extMap[ext] || 'application/octet-stream'
}

function isImage(mime: string) { return mime.startsWith('image/') }
function isPdf(mime: string) { return mime === 'application/pdf' }
function isCsv(mime: string) { return mime === 'text/csv' }
function isOfficeDoc(mime: string) {
    return [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ].includes(mime)
}

export default function DocumentPreviewModal({ doc, onClose }: DocumentPreviewModalProps) {
    const docId = doc.id || doc.ID
    const name = doc.original_name || doc.OriginalName || ''
    const size = doc.file_size_bytes || doc.FileSizeBytes || 0
    const rawMime = doc.mime_type || doc.MimeType || ''
    const mime = effectiveMime(rawMime, name)
    const docUrl = apiUrl(`/documents/${docId}`)
    const downloadUrl = apiUrl(`/documents/${docId}?download=true`)
    const previewUrl = `${docUrl}?v=${encodeURIComponent(String(docId))}`

    const renderPreview = () => {
        if (isImage(mime)) {
            return (
                <img
                    src={previewUrl}
                    alt={name}
                    className="max-w-full max-h-full object-contain shadow-lg rounded"
                />
            )
        }

        if (isPdf(mime)) {
            return (
                <iframe
                    src={previewUrl}
                    className="w-full h-full shadow-lg rounded bg-white"
                    title={name}
                />
            )
        }

        if (isCsv(mime)) {
            return (
                <iframe
                    src={previewUrl}
                    className="w-full h-full shadow-lg rounded bg-white font-mono text-sm"
                    title={name}
                />
            )
        }

        if (isOfficeDoc(mime)) {
            const ext = name.split('.').pop()?.toLowerCase() || ''
            const typeLabel: Record<string, string> = {
                doc: 'Microsoft Word', docx: 'Microsoft Word',
                xls: 'Microsoft Excel', xlsx: 'Microsoft Excel',
                ppt: 'Microsoft PowerPoint', pptx: 'Microsoft PowerPoint',
            }
            const colorClass: Record<string, string> = {
                doc: 'text-blue-600 bg-blue-50 border-blue-200',
                docx: 'text-blue-600 bg-blue-50 border-blue-200',
                xls: 'text-emerald-600 bg-emerald-50 border-emerald-200',
                xlsx: 'text-emerald-600 bg-emerald-50 border-emerald-200',
                ppt: 'text-orange-600 bg-orange-50 border-orange-200',
                pptx: 'text-orange-600 bg-orange-50 border-orange-200',
            }
            const classes = colorClass[ext] || 'text-slate-600 bg-slate-50 border-slate-200'

            return (
                <div className="text-center p-10 bg-white rounded-2xl shadow-sm max-w-md w-full">
                    <div className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center mx-auto mb-5 ${classes}`}>
                        <FileText size={36} />
                    </div>
                    <p className="font-bold text-slate-800 text-lg mb-1">{name}</p>
                    <p className="text-sm text-slate-500 mb-1">{typeLabel[ext] || 'Office Document'}</p>
                    <p className="text-xs text-slate-400 mb-6">{(size / 1024).toFixed(1)} KB — Pratinjau dokumen Office tidak tersedia di browser</p>
                    <div className="flex items-center justify-center gap-3">
                        <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-bold text-sm"
                        >
                            <ExternalLink size={16} />
                            Unduh File
                        </a>
                    </div>
                </div>
            )
        }

        return (
            <div className="text-center p-8 bg-white rounded-xl shadow-sm">
                <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="font-medium text-slate-800">Pratinjau tidak tersedia</p>
                <p className="text-sm text-slate-500 mb-4">Silakan unduh file untuk melihat isinya</p>
                <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                    <ExternalLink size={16} />
                    Unduh File
                </a>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col relative overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">{name}</h3>
                        <p className="text-sm text-slate-500">
                            {(size / 1024).toFixed(1)} KB • {mime !== rawMime ? `${mime}` : mime}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-auto p-4">
                    {renderPreview()}
                </div>
            </div>
        </div>
    )
}

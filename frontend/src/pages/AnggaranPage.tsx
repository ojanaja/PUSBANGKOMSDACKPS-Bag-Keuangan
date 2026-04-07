import { useState } from 'react'
import { Upload, ChevronRight, X, RefreshCw, AlertCircle, Loader2, FolderKanban, FileText, Database, Eye, ExternalLink, Edit2 } from 'lucide-react'
import { useAnggaran, useAnggaranDokumen, type TreeNode } from '@/features/anggaran/application/useAnggaran'
import FileDropzone from '@/components/common/FileDropzone'
import EditPaguModal from '@/features/anggaran/components/EditPaguModal'
import ImportPreviewModal from '@/features/anggaran/components/ImportPreviewModal'
import { apiUrl } from '@/shared/api/httpClient'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/formatCurrency'
import { FISCAL_YEAR_OPTIONS } from '@/shared/config/constants'
import { useToast } from '@/shared/hooks/useToast'

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

function FolderRow({ node, onClick, onUpload, onEdit }: { node: TreeNode; onClick: () => void; onUpload: (node: TreeNode) => void; onEdit: (node: TreeNode) => void }) {
    const hasChildren = node.children && node.children.length > 0
    const persentase = node.pagu_revisi > 0 ? (node.realisasi_sd_periode / node.pagu_revisi) * 100 : 0
    const currentUser = useAuthStore(s => s.user)
    const canEditPagu = currentUser?.Permissions?.includes('anggaran:update')
    const canReadDokumen = currentUser?.Permissions?.includes('dokumen:read')
    
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
                    <div className="flex flex-col items-center gap-2">
                        {canEditPagu && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onEdit(node); }}
                                className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-slate-200" 
                                title="Edit Pagu & Realisasi"
                            >
                                <Edit2 size={16} />
                                <span>Edit Data</span>
                            </button>
                        )}
                        {canReadDokumen && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onUpload(node); }}
                                className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-slate-200" 
                                title="Unggah dokumen bukti"
                            >
                                <Upload size={16} />
                                <span>Dokumen</span>
                            </button>
                        )}
                    </div>
                )}
            </td>
        </tr>
    )
}

export default function AnggaranPage() {
    const currentUser = useAuthStore(s => s.user)
    const canCreate = currentUser?.Permissions?.includes('anggaran:create')
    const { showToast } = useToast()
    
    const [showImportModal, setShowImportModal] = useState(false)
    const [tahun, setTahun] = useState(new Date().getFullYear())
    const [bulan, setBulan] = useState(new Date().getMonth() + 1)
    const [currentPathIds, setCurrentPathIds] = useState<string[]>([])
    const [uploadTarget, setUploadTarget] = useState<TreeNode | null>(null)
    const [editTarget, setEditTarget] = useState<TreeNode | null>(null)

    const { query, previewMutation, confirmImportMutation, updatePaguMutation, uploadBuktiMutation, copyDataMutation } = useAnggaran(tahun, bulan)
    const { data: uploadDocuments = [], refetch: refetchDocuments, isLoading: loadingDocs } = useAnggaranDokumen(uploadTarget?.id || null)

    const tree = query.data || []
    const loading = query.isLoading
    const error = query.error instanceof Error ? query.error.message : null

    const totalPagu = tree.reduce((sum, p) => sum + p.pagu_revisi, 0)
    const totalRealisasi = tree.reduce((sum, p) => sum + p.realisasi_sd_periode, 0)
    const totalSisa = tree.reduce((sum, p) => sum + p.sisa_anggaran, 0)



    const currentPath: TreeNode[] = []
    let currLevelNodes = tree
    for (const id of currentPathIds) {
        const found = currLevelNodes.find(n => n.id === id)
        if (found) {
            currentPath.push(found)
            currLevelNodes = found.children || []
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
                            onChange={(e) => { setTahun(Number(e.target.value)); setCurrentPathIds([]); }}
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
                            onChange={(e) => { setBulan(Number(e.target.value)); setCurrentPathIds([]); }}
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

                    {canCreate && (
                        <button
                            onClick={() => setShowImportModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
                        >
                            <Upload size={16} />
                            Unggah Excel/CSV
                        </button>
                    )}
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

            {currentPath.length > 0 && !loading && !error && (
                <Breadcrumbs 
                    path={currentPath} 
                    onNavigate={(idx) => {
                        if (idx === -1) {
                            setCurrentPathIds([])
                        } else {
                            setCurrentPathIds(currentPathIds.slice(0, idx + 1))
                        }
                    }} 
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
                            <p className="text-base text-slate-600 font-medium">Belum ada data anggaran untuk bulan ini</p>
                            <p className="text-sm text-slate-500 mt-1">Klik tombol "Unggah Excel/CSV" di atas untuk memasukkan data</p>

                            {bulan > 1 && canCreate && (
                                <button 
                                    onClick={() => {
                                        if (confirm(`Salin data dari bulan sebelumnya? Anda dapat mulai melakukan penyesuaian setelah data disalin.`)) {
                                            copyDataMutation.mutate({ tahun, fromBulan: bulan - 1, toBulan: bulan }, {
                                                onError: (e) => alert(e instanceof Error ? e.message : 'Gagal menyalin data')
                                            })
                                        }
                                    }}
                                    disabled={copyDataMutation.isPending}
                                    className="mt-6 px-4 py-2 bg-white border border-primary-300 text-primary-600 rounded-lg text-sm font-medium hover:bg-primary-50 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {copyDataMutation.isPending ? 'Menyalin data...' : `Atau Salin Data dari Bulan ${bulan - 1}`}
                                </button>
                            )}
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
                                            onClick={() => setCurrentPathIds([...currentPathIds, node.id])}
                                            onUpload={(n) => {
                                                setUploadTarget(n)
                                            }}
                                            onEdit={(n) => {
                                                setEditTarget(n)
                                            }}
                                        />
                                    ))
                                })()}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showImportModal && (
                <ImportPreviewModal
                    onClose={() => setShowImportModal(false)}
                    onImported={(t, b) => { setTahun(t); setBulan(b); setCurrentPathIds([]); setShowImportModal(false) }}
                    previewMutation={previewMutation}
                    confirmImportMutation={confirmImportMutation}
                />
            )}

            {
                uploadTarget && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setUploadTarget(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Arsip Digital</h3>
                                    <p className="text-base text-slate-600 mt-1 truncate max-w-[300px]" title={uploadTarget.uraian}>
                                        Manajemen Dokumen Bukti untuk {uploadTarget.kode}
                                    </p>
                                </div>
                                <button onClick={() => setUploadTarget(null)} className="p-1 rounded-lg hover:bg-slate-100 shrink-0">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            {currentUser?.Permissions?.includes('dokumen:create') && (
                                <FileDropzone 
                                    label="Unggah Dokumen Bukti" 
                                    type="document" 
                                    empty 
                                    uploading={uploadBuktiMutation.isPending ? { progress: '' } : undefined}
                                    onDrop={async (files: File[]) => {
                                        if (files.length > 0) {
                                            try {
                                                await uploadBuktiMutation.mutateAsync({ id: uploadTarget.id, file: files[0] })
                                                showToast('Dokumen berhasil diunggah', 'success')
                                                refetchDocuments()
                                            } catch (e) {
                                                showToast('Gagal mengunggah dokumen', 'error')
                                            }
                                        }
                                    }} 
                                />
                            )}

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
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">
                                                            {(doc.file_size_bytes / 1024).toFixed(1)} KB
                                                        </span>
                                                        <span className="text-xs text-slate-400 shrink-0">
                                                            {new Date(doc.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                                                            &bull; Diunggah oleh: <span className="font-medium text-slate-600">{doc.uploaded_by_name || 'Tidak diketahui'}</span>
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

            {editTarget && (
                <EditPaguModal 
                    node={editTarget} 
                    onClose={() => setEditTarget(null)} 
                    updatePaguMutation={updatePaguMutation} 
                />
            )}
        </div >
    )
}

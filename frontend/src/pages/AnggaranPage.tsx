import { useState } from 'react'
import { Upload, ChevronRight, X, RefreshCw, AlertCircle, Loader2, FolderKanban, FileText, Database, Eye, ExternalLink, Edit2, Trash2, User, Clock, Lock } from 'lucide-react'
import { useAnggaran, useAnggaranDokumen, useAnggaranSnapshots, type TreeNode } from '@/features/anggaran/application/useAnggaran'
import FileDropzone from '@/components/common/FileDropzone'
import EditPaguModal from '@/features/anggaran/components/EditPaguModal'
import ImportPreviewModal from '@/features/anggaran/components/ImportPreviewModal'
import { apiUrl } from '@/shared/api/httpClient'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/formatCurrency'
import { FISCAL_YEAR_OPTIONS } from '@/shared/config/constants'
import { useToast } from '@/shared/hooks/useToast'
import { useQueryClient } from '@tanstack/react-query'
import ConfirmDialog from '@/shared/ui/ConfirmDialog'
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

function FolderRow({ node, onClick, onUpload, onEdit, onDelete }: { node: TreeNode; onClick: () => void; onUpload: (node: TreeNode) => void; onEdit: (node: TreeNode) => void; onDelete: (node: TreeNode) => void }) {
    const hasChildren = node.children && node.children.length > 0
    const persentase = node.pagu_revisi > 0 ? (node.realisasi_sd_periode / node.pagu_revisi) * 100 : 0
    const currentUser = useAuthStore(s => s.user)
    const canEditPagu = currentUser?.Permissions?.includes('anggaran:update')
    const canDeleteNode = currentUser?.Permissions?.includes('anggaran:delete')
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
            <td className="px-6 py-5 border-b border-slate-100 align-top group">
                <div className="flex items-center justify-end gap-2 text-base tabular-nums text-slate-600">
                    <span>{formatCurrency(node.lock_pagu)}</span>
                    {canEditPagu && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(node); }}
                            className="text-slate-300 hover:text-amber-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Edit Lock Pagu"
                        >
                            <Lock size={15} />
                        </button>
                    )}
                </div>
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
                    {canDeleteNode && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(node); }}
                            className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-slate-200"
                            title="Hapus Akun/Rincian"
                        >
                            <Trash2 size={16} />
                            <span>Hapus</span>
                        </button>
                    )}
                </div>
            </td>
        </tr>
    )
}

const MONTH_OPTIONS = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' }
];

export default function AnggaranPage() {
    const queryClient = useQueryClient()
    const currentUser = useAuthStore(s => s.user)
    const canCreate = currentUser?.Permissions?.includes('anggaran:create')
    const { showToast } = useToast()

    const [showImportModal, setShowImportModal] = useState(false)
    const [tahun, setTahun] = useState(new Date().getFullYear())
    const [bulan, setBulan] = useState(new Date().getMonth() + 1)
    const [source, setSource] = useState<string>('fa_detail,emon,rkks')
    const [revisi, setRevisi] = useState<string>('')
    const [currentPathIds, setCurrentPathIds] = useState<string[]>([])
    const [uploadTarget, setUploadTarget] = useState<TreeNode | null>(null)
    const [editTarget, setEditTarget] = useState<TreeNode | null>(null)
    const [editingDoc, setEditingDoc] = useState<{ id: string, original_name: string } | null>(null)
    const [deleteDocTarget, setDeleteDocTarget] = useState<string | null>(null)
    const [deleteNodeTarget, setDeleteNodeTarget] = useState<TreeNode | null>(null)

    // Check if the selected month is the actual current month
    const now = new Date()
    const isCurrentMonth = tahun === now.getFullYear() && bulan === now.getMonth() + 1
    const targetPeriodePrefix = `${tahun}-${String(bulan).padStart(2, '0')}-Rev`
    const { data: snapshots = [] } = useAnggaranSnapshots(tahun)

    // Find all revisions for the selected month
    const availableRevisions = snapshots.filter(s => s.startsWith(targetPeriodePrefix)).sort()
    const suggestedNextRevisi = (() => {
        const nums = availableRevisions
            .map((rev) => {
                const suffix = rev.split('-Rev')[1] ?? ''
                const n = Number.parseInt(suffix, 10)
                return Number.isFinite(n) ? n : null
            })
            .filter((n): n is number => n !== null)
        const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1
        return String(next)
    })()

    // Determine the actual derived periode
    let derivedPeriode: string | undefined = revisi || undefined;
    if (!revisi) {
        if (isCurrentMonth) {
            derivedPeriode = undefined; // live data
        } else {
            // Default to latest revision, or fallback to first revision
            derivedPeriode = availableRevisions.length > 0 ? availableRevisions[availableRevisions.length - 1] : `${targetPeriodePrefix}1`;
        }
    }

    const { query, previewMutation, confirmImportMutation, updatePaguMutation, updateLockPaguMutation, uploadBuktiMutation, createSnapshotMutation, updateDokumenMutation, deleteDokumenMutation, deleteNodeMutation } = useAnggaran(tahun, derivedPeriode, source)
    const { data: uploadDocuments = [], refetch: refetchDocuments, isLoading: loadingDocs } = useAnggaranDokumen(uploadTarget?.id || null)

    const canUpdateDokumen = currentUser?.Permissions?.includes('dokumen:update')
    const canDeleteDokumen = currentUser?.Permissions?.includes('dokumen:delete')

    const handleDeleteDokumen = async () => {
        if (!deleteDocTarget) return
        try {
            await deleteDokumenMutation.mutateAsync(deleteDocTarget)
            showToast('Dokumen berhasil dihapus', 'success')
            refetchDocuments()
        } catch {
            showToast('Gagal menghapus dokumen', 'error')
        } finally {
            setDeleteDocTarget(null)
        }
    }

    const handleDeleteNode = async () => {
        if (!deleteNodeTarget) return
        try {
            await deleteNodeMutation.mutateAsync(deleteNodeTarget.id)
            showToast('Akun/Rincian berhasil dihapus', 'success')
        } catch {
            showToast('Gagal menghapus akun', 'error')
        } finally {
            setDeleteNodeTarget(null)
        }
    }

    const handleUpdateDokumen = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingDoc) return
        try {
            await updateDokumenMutation.mutateAsync({ documentId: editingDoc.id, original_name: editingDoc.original_name })
            showToast('Nama dokumen berhasil diperbarui', 'success')
            refetchDocuments()
            setEditingDoc(null)
        } catch {
            showToast('Gagal memperbarui nama dokumen', 'error')
        }
    }

    const tree = query.data || []
    const loading = query.isLoading
    const error = query.error instanceof Error ? query.error.message : null

    const rkksNodes = tree.filter(n => n.source === 'rkks')
    const faNodes = tree.filter(n => n.source === 'fa_detail' || n.source === 'emon')
    
    // Default fallback to all nodes if we don't have separate sources
    const paguSourceNodes = rkksNodes.length > 0 ? rkksNodes : tree
    const realisasiSourceNodes = faNodes.length > 0 ? faNodes : tree

    const totalPagu = paguSourceNodes.reduce((sum, p) => sum + p.pagu_revisi, 0)
    const totalRealisasi = realisasiSourceNodes.reduce((sum, p) => sum + p.realisasi_sd_periode, 0)
    const totalSisa = totalPagu - totalRealisasi


    const displayTree = source === 'fa_detail,emon,rkks' ? tree.filter(n => n.source === 'rkks').map(node => {
        // Gabungan mode: use RKKS as base tree, merge Realisasi from FA Detail based on kode
        const faMap = new Map<string, TreeNode>();
        const populateFaMap = (nodes: TreeNode[]) => {
            for (const n of nodes) {
                faMap.set(n.kode, n);
                
                if (n.kode.includes('.')) {
                    const parts = n.kode.split('.');
                    const lastPart = parts[parts.length - 1];
                    if (!faMap.has(lastPart)) {
                        faMap.set(lastPart, n);
                    }
                }
                
                if (n.children) populateFaMap(n.children);
            }
        };
        populateFaMap(faNodes);

        const mergeFaRealisasi = (n: TreeNode): TreeNode => {
            let realisasi_periode_lalu = n.realisasi_periode_lalu;
            let realisasi_periode_ini = n.realisasi_periode_ini;
            let realisasi_sd_periode = n.realisasi_sd_periode;
            
            let lookupKey = n.kode;
            if (n.kode.includes('.')) {
                const parts = n.kode.split('.');
                lookupKey = parts[parts.length - 1];
            }
            
            const faMatch = faMap.get(lookupKey) || faMap.get(n.kode);
            if (faMatch) {
                realisasi_periode_lalu = faMatch.realisasi_periode_lalu;
                realisasi_periode_ini = faMatch.realisasi_periode_ini;
                realisasi_sd_periode = faMatch.realisasi_sd_periode;
            }

            return {
                ...n,
                realisasi_periode_lalu,
                realisasi_periode_ini,
                realisasi_sd_periode,
                sisa_anggaran: n.pagu_revisi - realisasi_sd_periode,
                children: n.children ? n.children.map(mergeFaRealisasi) : []
            };
        };
        return mergeFaRealisasi(node);
    }) : tree;

    const currentPath: TreeNode[] = []
    let currLevelNodes = displayTree
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
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={tahun}
                            onChange={(e) => {
                                setTahun(Number(e.target.value));
                                setRevisi('');
                                setCurrentPathIds([]);
                            }}
                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-medium"
                            title="Tahun Anggaran"
                        >
                            {FISCAL_YEAR_OPTIONS.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>

                        <select
                            value={source}
                            onChange={(e) => {
                                setSource(e.target.value);
                                queryClient.invalidateQueries({ queryKey: ['anggaran'] });
                                setCurrentPathIds([]);
                            }}
                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-medium"
                            title="Sumber Data"
                        >
                            <option value="fa_detail,emon">FA Detail</option>
                            <option value="rkks">RKKS</option>
                            <option value="fa_detail,emon,rkks">Gabungan</option>
                        </select>

                        <select
                            value={bulan}
                            onChange={(e) => {
                                setBulan(Number(e.target.value));
                                setRevisi('');
                                setCurrentPathIds([]);
                            }}
                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-medium"
                            title="Bulan"
                        >
                            {MONTH_OPTIONS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>

                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white" title="Nomor Revisi">
                            <span className="px-3 py-2 text-sm text-slate-500 border-r border-slate-200 bg-slate-50 font-medium">
                                Rev
                            </span>
                            <select
                                value={derivedPeriode || 'live'}
                                onChange={(e) => {
                                    setRevisi(e.target.value === 'live' ? '' : e.target.value);
                                    queryClient.invalidateQueries({ queryKey: ['anggaran'] });
                                    setCurrentPathIds([]);
                                }}
                                className="w-24 px-2 py-2 text-sm focus:outline-none font-medium bg-white cursor-pointer"
                            >
                                {isCurrentMonth && <option value="live">Live</option>}
                                {Array.from({ length: 21 }, (_, i) => {
                                    const revValue = `${targetPeriodePrefix}${i}`;
                                    return (
                                        <option key={revValue} value={revValue}>{i}</option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            queryClient.invalidateQueries({ queryKey: ['anggaran'] });
                            query.refetch();
                        }}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-3 border border-slate-200 rounded-lg text-base text-slate-600 hover:bg-slate-50 transition-colors"
                        title="Perbarui Data"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Perbarui Data
                    </button>

                    {canCreate && (
                        <>
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
                            >
                                <Upload size={16} />
                                Unggah Excel
                            </button>
                        </>
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
                            {displayTree.length} baris ditampilkan
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
                            <p className="text-base text-slate-600 font-medium">Belum ada data anggaran</p>
                            <p className="text-sm text-slate-500 mt-1">Klik tombol "Unggah Excel" di atas untuk memasukkan data</p>
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
                                    <th className="px-6 py-4 text-right font-semibold text-slate-700 text-base">Total s.d. Bulan Ini<br />& Persentase</th>
                                    <th className="px-6 py-4 text-right font-semibold text-slate-700 text-base">Sisa Anggaran</th>
                                    <th className="px-6 py-4 text-center font-semibold text-slate-700 text-base">Pilihan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(() => {
                                    const currentNodes = currentPath.length === 0 ? displayTree : currentPath[currentPath.length - 1].children || []
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
                                            onDelete={(n) => {
                                                setDeleteNodeTarget(n)
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
                    onImported={({ tahun: importedTahun, bulan: importedBulan, periode }) => {
                        setTahun(importedTahun)
                        setBulan(importedBulan)
                        setRevisi(periode)
                        setCurrentPathIds([])
                        setShowImportModal(false)
                    }}
                    initialTahun={tahun}
                    initialBulan={bulan}
                    initialRevisi={suggestedNextRevisi}
                    previewMutation={previewMutation}
                    confirmImportMutation={confirmImportMutation}
                    createSnapshotMutation={createSnapshotMutation}
                />
            )}

            {
                uploadTarget && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setUploadTarget(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col" style={{ maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
                            {/* Header - Fixed */}
                            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 shrink-0">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Arsip Digital</h3>
                                    <p className="text-base text-slate-600 mt-1 truncate max-w-[400px]" title={uploadTarget.uraian}>
                                        Manajemen Dokumen Bukti untuk <span className="font-semibold text-primary-700">{uploadTarget.kode}</span>
                                    </p>
                                </div>
                                <button onClick={() => setUploadTarget(null)} className="p-2 rounded-lg hover:bg-slate-100 shrink-0 transition-colors">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            {/* Scrollable Body */}
                            <div className="overflow-y-auto flex-1 px-8 py-6">
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
                                                    console.error(e)
                                                    showToast('Gagal mengunggah dokumen', 'error')
                                                }
                                            }
                                        }}
                                    />
                                )}

                                {/* Document List */}
                                <div className="mt-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Daftar Dokumen</h4>
                                        {uploadDocuments.length > 0 && (
                                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full font-medium">
                                                {uploadDocuments.length} dokumen
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        {loadingDocs ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 size={24} className="text-primary-500 animate-spin" />
                                                <span className="ml-3 text-sm text-slate-500">Memuat dokumen...</span>
                                            </div>
                                        ) : uploadDocuments.length === 0 ? (
                                            <div className="text-center py-8 text-sm text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                <FileText size={32} className="text-slate-300 mx-auto mb-2" />
                                                Belum ada dokumen yang diunggah.
                                            </div>
                                        ) : (
                                            uploadDocuments.map(doc => (
                                                <div key={doc.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl group hover:border-primary-300 hover:shadow-sm transition-all">
                                                    <div className="flex items-start gap-4">
                                                        {/* File Icon */}
                                                        <div className="p-2.5 bg-white rounded-lg shadow-sm border border-slate-100 shrink-0">
                                                            <FileText size={22} className="text-primary-500" />
                                                        </div>

                                                        {/* File Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-slate-800 truncate" title={doc.original_name}>
                                                                {doc.original_name}
                                                            </p>

                                                            {/* Metadata Grid */}
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1.5 mt-2.5">
                                                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                                    <User size={13} className="text-slate-400 shrink-0" />
                                                                    <span className="text-slate-400">Pengunggah:</span>
                                                                    <span className="font-semibold text-slate-700 truncate">{doc.uploaded_by_name || 'Tidak diketahui'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                                    <Clock size={13} className="text-slate-400 shrink-0" />
                                                                    <span className="text-slate-400">Waktu:</span>
                                                                    <span className="font-medium text-slate-600">
                                                                        {new Date(doc.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                                    <FileText size={13} className="text-slate-400 shrink-0" />
                                                                    <span className="text-slate-400">Ukuran:</span>
                                                                    <span className="font-medium text-slate-600 uppercase tracking-wide">
                                                                        {(doc.file_size_bytes / 1024).toFixed(1)} KB
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Action Buttons */}
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {(doc.mime_type.startsWith('image/') || doc.mime_type === 'application/pdf') && (
                                                                <a
                                                                    href={apiUrl(`/documents/${doc.id}`)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1.5 px-3 py-2 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-xs font-bold transition-all border border-sky-100"
                                                                    title="Buka preview di tab baru"
                                                                >
                                                                    <Eye size={14} /> Lihat
                                                                </a>
                                                            )}
                                                            <a
                                                                href={apiUrl(`/documents/${doc.id}?download=true`)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-all border border-indigo-100"
                                                                title="Unduh Dokumen"
                                                            >
                                                                <ExternalLink size={14} /> Unduh
                                                            </a>
                                                            {canUpdateDokumen && (
                                                                <button
                                                                    onClick={() => setEditingDoc({ id: doc.id, original_name: doc.original_name })}
                                                                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-bold transition-all border border-amber-100"
                                                                    title="Edit Nama Dokumen"
                                                                >
                                                                    <Edit2 size={14} /> Edit
                                                                </button>
                                                            )}
                                                            {canDeleteDokumen && (
                                                                <button
                                                                    onClick={() => setDeleteDocTarget(doc.id)}
                                                                    className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-bold transition-all border border-red-100"
                                                                    title="Hapus Dokumen"
                                                                >
                                                                    <Trash2 size={14} /> Hapus
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Footer - Fixed */}
                            <div className="flex items-center justify-end gap-3 px-8 py-4 border-t border-slate-100 shrink-0">
                                <button
                                    onClick={() => setUploadTarget(null)}
                                    className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
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
                    updateLockPaguMutation={updateLockPaguMutation}
                />
            )}

            {editingDoc && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Nama Dokumen</h3>
                        <form onSubmit={handleUpdateDokumen}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Dokumen</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm"
                                    value={editingDoc.original_name}
                                    onChange={(e) => setEditingDoc({ ...editingDoc, original_name: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingDoc(null)}
                                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-semibold transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={updateDokumenMutation.isPending}
                                    className="flex-1 px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-lg text-sm font-semibold inline-flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {updateDokumenMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Edit2 size={16} />}
                                    Simpan Perubahan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={deleteDocTarget !== null}
                title="Hapus Dokumen?"
                message="Apakah Anda yakin ingin menghapus dokumen ini? Dokumen yang dihapus tidak dapat dikembalikan."
                confirmLabel="Hapus"
                variant="danger"
                loading={deleteDokumenMutation.isPending}
                onConfirm={handleDeleteDokumen}
                onCancel={() => setDeleteDocTarget(null)}
            />

            <ConfirmDialog
                open={deleteNodeTarget !== null}
                title="Hapus Akun/Rincian?"
                message={`Apakah Anda yakin ingin menghapus rincian ${deleteNodeTarget?.kode} - ${deleteNodeTarget?.uraian} beserta seluruh sub-rincian di dalamnya? Anggaran pada tingkat di atasnya akan dikurangi secara otomatis. Tindakan ini permanen dan tidak dapat dibatalkan.`}
                confirmLabel="Hapus Permanen"
                variant="danger"
                loading={deleteNodeMutation.isPending}
                onConfirm={handleDeleteNode}
                onCancel={() => setDeleteNodeTarget(null)}
            />
        </div >
    )
}

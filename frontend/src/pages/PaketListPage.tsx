import { useState } from 'react'
import { Plus, Search, Download, FolderKanban, ExternalLink, Loader2, AlertCircle, TrendingUp, Edit2, Trash2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '@/shared/ui/PageHeader'
import AppTextButton from '@/shared/ui/AppTextButton'
import { apiUrl } from '@/shared/api/httpClient'
import { usePaketList, type Paket } from '@/features/paket/application/usePaketList'
import { formatCurrency } from '@/lib/formatCurrency'
import { FISCAL_YEAR_OPTIONS } from '@/shared/config/constants'
import { useToast } from '@/shared/hooks/useToast'

export default function PaketListPage() {
    const [search, setSearch] = useState('')
    const [tahun, setTahun] = useState(new Date().getFullYear())
    const { showToast } = useToast()

    const { query, updateMutation, deleteMutation } = usePaketList(tahun)
    const pakets = query.data || []
    const loading = query.isLoading
    const error = query.error instanceof Error ? query.error.message : null

    const [editModalOpen, setEditModalOpen] = useState(false)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [selectedPaket, setSelectedPaket] = useState<Paket | null>(null)
    const [editData, setEditData] = useState<Partial<Paket>>({})

    const submitting = updateMutation.isPending || deleteMutation.isPending

    const handleExportExcel = () => {
        window.location.href = apiUrl(`/paket/export?tahun=${tahun}`)
    }

    const handleEditClick = (paket: Paket) => {
        setSelectedPaket(paket)
        setEditData({
            NamaPaket: paket.NamaPaket,
            Kasatker: paket.Kasatker,
            Lokasi: paket.Lokasi,
            PaguPaket: paket.PaguPaket
        })
        setEditModalOpen(true)
    }

    const handleDeleteClick = (paket: Paket) => {
        setSelectedPaket(paket)
        setDeleteModalOpen(true)
    }

    const submitEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedPaket) return
        try {
            await updateMutation.mutateAsync({ id: selectedPaket.ID, data: editData })
            setEditModalOpen(false)
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error')
        }
    }

    const submitDelete = async () => {
        if (!selectedPaket) return
        try {
            await deleteMutation.mutateAsync(selectedPaket.ID)
            setDeleteModalOpen(false)
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error')
        }
    }

    const filteredPakets = pakets.filter(p =>
        p.NamaPaket.toLowerCase().includes(search.toLowerCase()) ||
        p.Kasatker.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <PageHeader
                title="Progres Satker"
                description="Kelola paket pekerjaan, lapor progres, dan lihat visualisasi kurva-S"
                actions={(
                    <>
                        <AppTextButton label="Unduh Excel" icon={<Download size={16} />} onClick={handleExportExcel} />
                        <Link to="/progres-satker/tambah" className="inline-flex items-center gap-2 text-sm text-primary-600 font-semibold px-2 py-1 hover:underline">
                            <Plus size={16} />
                            Tambah Paket
                        </Link>
                    </>
                )}
            />

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari nama paket atau kasatker..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-500 font-medium whitespace-nowrap">Tahun Anggaran:</label>
                        <select
                            value={tahun}
                            onChange={(e) => setTahun(Number(e.target.value))}
                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-bold text-primary-600 shadow-sm outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            {FISCAL_YEAR_OPTIONS.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 size={32} className="text-primary-500 animate-spin" />
                            <p className="text-sm text-slate-500 font-medium">Memuat daftar paket...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                            <AlertCircle size={40} className="text-red-400" />
                            <p className="text-red-600 font-medium">{error}</p>
                            <AppTextButton label="Coba lagi" onClick={() => query.refetch()} />
                        </div>
                    ) : filteredPakets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <FolderKanban size={32} className="text-slate-300" />
                            </div>
                            <p className="text-slate-500 font-medium">Belum ada paket pekerjaan</p>
                            <p className="text-sm text-slate-400 mt-1">Klik tombol "+ Tambah Paket Baru" untuk memulai</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <caption className="sr-only">Daftar Paket Pekerjaan</caption>
                            <thead>
                                <tr>
                                    <th className="px-6 py-4">Nama Paket</th>
                                    <th className="px-6 py-4">Kasatker / Lokasi</th>
                                    <th className="px-6 py-4 text-right">Pagu</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPakets.map((paket) => (
                                    <tr key={paket.ID} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-800">{paket.NamaPaket}</div>
                                            <div className="text-xs text-slate-400 mt-0.5 font-mono">{paket.ID}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-slate-700">{paket.Kasatker}</div>
                                            <div className="text-xs text-slate-400">{paket.Lokasi}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-slate-700 tabular-nums">
                                            {formatCurrency(paket.PaguPaket)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {(() => {
                                                const pctKeu = paket.PaguAnggaran > 0 ? (paket.RealisasiAnggaran / paket.PaguAnggaran) * 100 : 0
                                                const pctFis = paket.RealisasiFisik

                                                let status = 'LENGKAP'
                                                let color = 'bg-emerald-100 text-emerald-700 border-emerald-200'

                                                if (pctKeu > 0 && pctFis === 0) {
                                                    status = 'KRITIS'
                                                    color = 'bg-red-100 text-red-700 border-red-200'
                                                } else if (pctFis < pctKeu * 0.9) {
                                                    status = 'PERINGATAN'
                                                    color = 'bg-amber-100 text-amber-700 border-amber-200'
                                                }

                                                return (
                                                    <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${color}`}>
                                                        {status}
                                                    </span>
                                                )
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Link
                                                        to={`/progres/${paket.ID}`}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-xs font-bold transition-all border border-sky-100"
                                                        title="Lihat Detail & Lapor Progres"
                                                    >
                                                        <ExternalLink size={14} />
                                                        Detail
                                                    </Link>
                                                    <Link
                                                        to={`/kurva-s/${paket.ID}`}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-all border border-indigo-100"
                                                        title="Lihat Kurva-S"
                                                    >
                                                        <TrendingUp size={14} />
                                                        Kurva S
                                                    </Link>
                                                </div>
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleEditClick(paket)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-bold transition-all border border-amber-100"
                                                        title="Edit Paket"
                                                    >
                                                        <Edit2 size={14} />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(paket)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-bold transition-all border border-red-100"
                                                        title="Hapus Paket"
                                                    >
                                                        <Trash2 size={14} />
                                                        Hapus
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {
                editModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                <h3 className="font-bold text-lg text-slate-800">Edit Paket Pekerjaan</h3>
                                <button onClick={() => setEditModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-4 overflow-y-auto">
                                <form id="edit-paket-form" onSubmit={submitEdit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nama Paket</label>
                                        <input type="text" value={editData.NamaPaket || ''} onChange={(e) => setEditData({ ...editData, NamaPaket: e.target.value })} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Kasatker</label>
                                        <input type="text" value={editData.Kasatker || ''} onChange={(e) => setEditData({ ...editData, Kasatker: e.target.value })} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Lokasi</label>
                                        <input type="text" value={editData.Lokasi || ''} onChange={(e) => setEditData({ ...editData, Lokasi: e.target.value })} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Pagu Paket</label>
                                        <input type="number" value={editData.PaguPaket || ''} onChange={(e) => setEditData({ ...editData, PaguPaket: Number(e.target.value) })} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm" />
                                    </div>
                                </form>
                            </div>
                            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                                <AppTextButton label="Batal" onClick={() => setEditModalOpen(false)} />
                                <AppTextButton label={submitting ? 'Menyimpan...' : 'Simpan perubahan'} type="submit" form="edit-paket-form" disabled={submitting} color="primary" />
                            </div>
                        </div>
                    </div>
                )
            }

            {
                deleteModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <AlertCircle size={32} />
                                </div>
                                <h3 className="font-bold text-lg text-slate-800 mb-2">Hapus Paket Pekerjaan?</h3>
                                <p className="text-sm text-slate-500">
                                    Tindakan ini tidak dapat dibatalkan. Menghapus paket akan menghapus semua data realisasi dan dokumen yang terkait.
                                </p>
                            </div>
                            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                                <AppTextButton label="Batal" onClick={() => setDeleteModalOpen(false)} fullWidth />
                                <AppTextButton label={submitting ? 'Menghapus...' : 'Hapus paket'} onClick={submitDelete} disabled={submitting} color="error" fullWidth />
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    )
}

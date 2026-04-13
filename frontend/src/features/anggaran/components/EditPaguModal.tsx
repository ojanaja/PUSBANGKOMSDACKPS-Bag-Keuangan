import { useState } from 'react'
import { X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { TreeNode } from '@/features/anggaran/application/useAnggaran'
import { useToast } from '@/shared/hooks/useToast'

interface EditPaguModalProps {
    node: TreeNode
    onClose: () => void
    updatePaguMutation: UseMutationResult<unknown, Error, { id: string, data: Record<string, string> }>
    updateLockPaguMutation: UseMutationResult<unknown, Error, { id: string, lock_pagu: string }>
}

export default function EditPaguModal({ node, onClose, updatePaguMutation, updateLockPaguMutation }: EditPaguModalProps) {
    const [paguRevisi, setPaguRevisi] = useState(node.pagu_revisi.toString())
    const [lockPagu, setLockPagu] = useState(node.lock_pagu.toString())
    const [realisasiLalu, setRealisasiLalu] = useState(node.realisasi_periode_lalu.toString())
    const [realisasiIni, setRealisasiIni] = useState(node.realisasi_periode_ini.toString())
    const [error, setError] = useState<string | null>(null)
    const { showToast } = useToast()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        try {
            // Kita bisa menjalankan kedua mutasi secara paralel (hanya mengubah apa yang diperlukan, tapi UI saat ini mengirim keduanya sekalian)
            await Promise.all([
                updatePaguMutation.mutateAsync({
                    id: node.id,
                    data: {
                        pagu_revisi: paguRevisi,
                        realisasi_periode_lalu: realisasiLalu,
                        realisasi_periode_ini: realisasiIni
                    }
                }),
                updateLockPaguMutation.mutateAsync({
                    id: node.id,
                    lock_pagu: lockPagu
                })
            ])
            showToast('Berhasil mengubah nilai anggaran & lock pagu', 'success')
            onClose()
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Terjadi kesalahan'
            setError(msg)
            showToast(msg, 'error')
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pb-2 border-b border-slate-100">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Edit Pagu</h3>
                        <p className="text-sm text-slate-500 font-mono mt-1">{node.kode} - {node.uraian}</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 self-start">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Pagu Revisi (Rp)</label>
                            <input
                                type="number"
                                value={paguRevisi}
                                onChange={e => setPaguRevisi(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:ring focus:ring-primary-100"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-amber-700 mb-1.5">Lock Pagu (Rp)</label>
                            <input
                                type="number"
                                value={lockPagu}
                                onChange={e => setLockPagu(e.target.value)}
                                className="w-full border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 text-sm focus:border-amber-500 focus:ring focus:ring-amber-100"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Realisasi Periode Lalu (Rp)</label>
                            <input
                                type="number"
                                value={realisasiLalu}
                                onChange={e => setRealisasiLalu(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Realisasi Periode Ini (Rp)</label>
                            <input
                                type="number"
                                value={realisasiIni}
                                onChange={e => setRealisasiIni(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertCircle size={16} className="text-red-500 shrink-0" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={updatePaguMutation.isPending || updateLockPaguMutation.isPending}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {(updatePaguMutation.isPending || updateLockPaguMutation.isPending) ? (
                                <><Loader2 size={16} className="animate-spin" /> Menyimpan...</>
                            ) : (
                                <><CheckCircle2 size={16} /> Simpan</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

import { useState } from 'react'
import { X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { UseMutationResult } from '@tanstack/react-query'
import { FISCAL_YEAR_OPTIONS } from '@/shared/config/constants'

interface ManualData {
    program_kode: string; program_uraian: string
    kegiatan_kode: string; kegiatan_uraian: string
    output_kode: string; output_uraian: string
    suboutput_kode: string; suboutput_uraian: string
    akun_kode: string; akun_uraian: string
    pagu: string; realisasi: string; sisa: string
}

const emptyManualData: ManualData = {
    program_kode: '', program_uraian: '',
    kegiatan_kode: '', kegiatan_uraian: '',
    output_kode: '', output_uraian: '',
    suboutput_kode: '', suboutput_uraian: '',
    akun_kode: '', akun_uraian: '',
    pagu: '', realisasi: '', sisa: ''
}

interface ManualInputModalProps {
    onClose: () => void
    onSaved: (tahun: number) => void
    manualMutation: UseMutationResult<unknown, Error, Record<string, unknown>>
}

export default function ManualInputModal({ onClose, onSaved, manualMutation }: ManualInputModalProps) {
    const [manualTahun, setManualTahun] = useState(new Date().getFullYear())
    const [manualData, setManualData] = useState<ManualData>(emptyManualData)
    const [manualError, setManualError] = useState<string | null>(null)

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setManualError(null)

        try {
            const payload = {
                tahun_anggaran: manualTahun,
                program_kode: manualData.program_kode,
                program_uraian: manualData.program_uraian,
                kegiatan_kode: manualData.kegiatan_kode,
                kegiatan_uraian: manualData.kegiatan_uraian,
                output_kode: manualData.output_kode,
                output_uraian: manualData.output_uraian,
                suboutput_kode: manualData.suboutput_kode,
                suboutput_uraian: manualData.suboutput_uraian,
                akun_kode: manualData.akun_kode,
                akun_uraian: manualData.akun_uraian,
                pagu: Number(manualData.pagu) || 0,
                realisasi: Number(manualData.realisasi) || 0,
                sisa: Number(manualData.sisa) || 0,
            }

            await manualMutation.mutateAsync(payload)
            setManualData(emptyManualData)
            onSaved(manualTahun)
        } catch (e) {
            setManualError(e instanceof Error ? e.message : 'Terjadi kesalahan')
        }
    }

    const formFields: Array<{ key: keyof ManualData; label: string; placeholder: string; type?: string }> = [
        { key: 'program_kode', label: 'Kode Program', placeholder: 'Contoh: 033.01.WA' },
        { key: 'program_uraian', label: 'Uraian Program', placeholder: 'Program Utama...' },
        { key: 'kegiatan_kode', label: 'Kode Kegiatan', placeholder: 'Contoh: 4054' },
        { key: 'kegiatan_uraian', label: 'Uraian Kegiatan', placeholder: 'Kegiatan...' },
        { key: 'output_kode', label: 'Kode Output', placeholder: 'Contoh: 4054.EBA' },
        { key: 'output_uraian', label: 'Uraian Output', placeholder: 'Output...' },
        { key: 'suboutput_kode', label: 'Kode SubOutput', placeholder: 'Contoh: 4054.EBA.994' },
        { key: 'suboutput_uraian', label: 'Uraian SubOutput', placeholder: 'SubOutput...' },
        { key: 'akun_kode', label: 'Kode Akun', placeholder: 'Contoh: 533111' },
        { key: 'akun_uraian', label: 'Uraian Akun', placeholder: 'Belanja Modal...' },
        { key: 'pagu', label: 'Pagu Anggaran (Rp)', placeholder: '0', type: 'number' },
        { key: 'realisasi', label: 'Realisasi Keluar (Rp)', placeholder: '0', type: 'number' },
        { key: 'sisa', label: 'Sisa Anggaran (Rp)', placeholder: '0', type: 'number' },
    ]

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pb-2 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900">Input Manual DIPA Anggaran</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleManualSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tahun Anggaran</label>
                            <select
                                value={manualTahun}
                                onChange={(e) => setManualTahun(Number(e.target.value))}
                                className="w-full lg:w-1/2 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                required
                            >
                                {FISCAL_YEAR_OPTIONS.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        {formFields.map(({ key, label, placeholder, type }) => (
                            <div key={key}>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                                <input
                                    type={type || 'text'}
                                    value={manualData[key]}
                                    onChange={e => setManualData({ ...manualData, [key]: e.target.value })}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                    placeholder={placeholder}
                                    required
                                />
                            </div>
                        ))}
                    </div>

                    {manualError && (
                        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertCircle size={16} className="text-red-500 shrink-0" />
                            <p className="text-sm text-red-700">{manualError}</p>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={manualMutation.isPending}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {manualMutation.isPending ? (
                                <><Loader2 size={16} className="animate-spin" /> Menyimpan...</>
                            ) : (
                                <><CheckCircle2 size={16} /> Simpan Anggaran</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

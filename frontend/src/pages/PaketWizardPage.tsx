import { useState } from 'react'
import { Check, ChevronRight, Search, Loader2, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePaketWizard } from '@/features/paket/application/usePaketWizard'
import { formatCurrency } from '@/lib/formatCurrency'
import { MONTHS_SHORT } from '@/shared/config/months'

const steps = ['Profil Paket', 'Mapping Anggaran', 'Target Bulanan']
const months = MONTHS_SHORT

export default function PaketPage() {
    const navigate = useNavigate()
    const tahun = new Date().getFullYear()
    const { akunQuery, createMutation } = usePaketWizard(tahun)

    const [step, setStep] = useState(0)
    const [error, setError] = useState<string | null>(null)

    const [nama, setNama] = useState('')
    const [kasatker, setKasatker] = useState('')
    const [lokasi, setLokasi] = useState('')
    const [pagu, setPagu] = useState('')
    const [errors, setErrors] = useState<Record<string, string>>({})

    const [search, setSearch] = useState('')
    const [selectedAkunIds, setSelectedAkunIds] = useState<string[]>([])

    const [keuangan, setKeuangan] = useState<number[]>(Array(12).fill(0))
    const [fisik, setFisik] = useState<number[]>(Array(12).fill(0))

    const akunList = akunQuery.data ?? []
    const loadingAkun = akunQuery.isLoading
    const submitting = createMutation.isPending

    const validateStep1 = () => {
        const e: Record<string, string> = {}
        if (!nama.trim()) e.nama = 'Nama Paket wajib diisi'
        if (!kasatker.trim()) e.kasatker = 'Kasatker wajib diisi'
        if (!lokasi.trim()) e.lokasi = 'Lokasi wajib diisi'
        if (!pagu.trim() || isNaN(Number(pagu))) e.pagu = 'Pagu Paket valid wajib diisi'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const nextStep = () => {
        if (step === 0 && !validateStep1()) return
        if (step === 1 && selectedAkunIds.length === 0) {
            setError('Pilih minimal satu akun anggaran')
            return
        }
        if (step < 2) {
            setError(null)
            setStep(step + 1)
        } else {
            handleSubmit()
        }
    }

    const handleSubmit = async () => {
        setError(null)

        createMutation.mutate(
            {
                nama: nama,
                kasatker: kasatker,
                lokasi: lokasi,
                pagu: Number(pagu),
                akun_ids: selectedAkunIds,
                target_keuangan: keuangan,
                target_fisik: fisik,
            },
            {
                onSuccess: () => navigate('/progres'),
                onError: (e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan'),
            }
        )
    }

    const filteredAkun = akunList.filter(
        (a) => (a.AkunKode || '').includes(search) || (a.AkunUraian || '').toLowerCase().includes(search.toLowerCase())
    )

    const totalKeu = keuangan.reduce((a, b) => a + b, 0)
    const totalFis = fisik.reduce((a, b) => a + b, 0)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Tambah Paket Proyek Baru</h1>
                <p className="text-sm text-slate-500 mt-1">Form Wizard - Manajemen Paket Pekerjaan</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-center mb-10 overflow-x-auto pb-4">
                    {steps.map((s, i) => (
                        <div key={s} className="flex items-center">
                            <div className="flex items-center gap-3">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${i < step ? 'bg-emerald-500 text-white' :
                                        i === step ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30' :
                                            'bg-slate-100 text-slate-400'
                                        }`}
                                >
                                    {i < step ? <Check size={20} /> : i + 1}
                                </div>
                                <span className={`text-sm font-semibold whitespace-nowrap ${i === step ? 'text-primary-700' : 'text-slate-400'}`}>
                                    {s}
                                </span>
                            </div>
                            {i < steps.length - 1 && (
                                <div className={`h-px w-12 mx-4 ${i < step ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                            )}
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
                        <AlertCircle size={20} className="shrink-0" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                {step === 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Paket Pekerjaan</label>
                            <input
                                type="text"
                                placeholder="Contoh: Rehabilitasi Gedung Kantor"
                                value={nama}
                                onChange={(e) => { setNama(e.target.value); if (errors.nama) setErrors({ ...errors, nama: '' }) }}
                                className={`w-full px-4 py-2.5 border rounded-xl text-sm transition-all focus:ring-2 focus:ring-primary-500 focus:outline-none ${errors.nama ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                            />
                            {errors.nama && <p className="text-xs text-red-500 mt-1.5">{errors.nama}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Kasatker / Pejabat</label>
                            <input
                                type="text"
                                placeholder="Nama Pejabat Pembuat Komitmen"
                                value={kasatker}
                                onChange={(e) => { setKasatker(e.target.value); if (errors.kasatker) setErrors({ ...errors, kasatker: '' }) }}
                                className={`w-full px-4 py-2.5 border rounded-xl text-sm transition-all focus:ring-2 focus:ring-primary-500 focus:outline-none ${errors.kasatker ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                            />
                            {errors.kasatker && <p className="text-xs text-red-500 mt-1.5">{errors.kasatker}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Lokasi Pekerjaan</label>
                            <input
                                type="text"
                                placeholder="Contoh: Jakarta Selatan"
                                value={lokasi}
                                onChange={(e) => { setLokasi(e.target.value); if (errors.lokasi) setErrors({ ...errors, lokasi: '' }) }}
                                className={`w-full px-4 py-2.5 border rounded-xl text-sm transition-all focus:ring-2 focus:ring-primary-500 focus:outline-none ${errors.lokasi ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                            />
                            {errors.lokasi && <p className="text-xs text-red-500 mt-1.5">{errors.lokasi}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Pagu Paket (Rp)</label>
                            <input
                                type="number"
                                placeholder="Total nilai pagu"
                                value={pagu}
                                onChange={(e) => { setPagu(e.target.value); if (errors.pagu) setErrors({ ...errors, pagu: '' }) }}
                                className={`w-full px-4 py-2.5 border rounded-xl text-sm transition-all focus:ring-2 focus:ring-primary-500 focus:outline-none ${errors.pagu ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                            />
                            {errors.pagu && <p className="text-xs text-red-500 mt-1.5">{errors.pagu}</p>}
                        </div>
                    </div>
                )}

                {step === 1 && (
                    <div className="max-w-4xl mx-auto space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="relative flex-1">
                                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Cari kode akun atau uraian anggaran..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-11 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <span className="text-sm font-medium text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg whitespace-nowrap">
                                {selectedAkunIds.length} Terpilih
                            </span>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="max-h-[400px] overflow-y-auto">
                                <table className="w-full text-sm">
                                    <caption className="sr-only">Daftar Akun Anggaran</caption>
                                    <thead className="sticky top-0 bg-slate-50 shadow-sm">
                                        <tr className="text-left text-slate-500 font-semibold">
                                            <th className="px-6 py-3 w-16">Pilih</th>
                                            <th className="px-6 py-3">Kode Akun</th>
                                            <th className="px-6 py-3">Uraian Anggaran</th>
                                            <th className="px-6 py-3 text-right">Pagu DIPA</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {loadingAkun ? (
                                            <tr>
                                                <td colSpan={4} className="py-20 text-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Loader2 size={24} className="text-primary-500 animate-spin" />
                                                        <span className="text-slate-500 font-medium">Memuat data anggaran...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredAkun.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="py-20 text-center text-slate-400 italic">
                                                    Tidak ada data anggaran yang sesuai
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredAkun.map((akun, idx) => (
                                                <tr
                                                    key={akun.AkunID || idx}
                                                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedAkunIds.includes(akun.AkunID) ? 'bg-primary-50/30' : ''}`}
                                                    onClick={() => {
                                                        if (selectedAkunIds.includes(akun.AkunID)) {
                                                            setSelectedAkunIds(selectedAkunIds.filter(id => id !== akun.AkunID))
                                                        } else {
                                                            setSelectedAkunIds([...selectedAkunIds, akun.AkunID])
                                                        }
                                                    }}
                                                >
                                                    <td className="px-6 py-4 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedAkunIds.includes(akun.AkunID)}
                                                            onChange={() => { }}
                                                            className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 accent-primary-600"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 font-mono font-medium text-primary-600">{akun.AkunKode}</td>
                                                    <td className="px-6 py-4 text-slate-700">{akun.AkunUraian}</td>
                                                    <td className="px-6 py-4 text-right tabular-nums text-slate-600">{formatCurrency(akun.Pagu)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="max-w-5xl mx-auto space-y-6">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <h4 className="text-sm font-bold text-slate-800 mb-1">Panduan Pengisian:</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Masukkan target capaian akumulatif untuk setiap bulannya. Total persentase (keuangan dan fisik) di bulan terakhir (Desember) harus mencapai 100%.
                            </p>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-sm">
                                <caption className="sr-only">Target Capaian Bulanan</caption>
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 text-left sticky left-0 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Indikator</th>
                                        {months.map((m) => (
                                            <th key={m} className="px-4 py-3 text-center min-w-[70px]">{m}</th>
                                        ))}
                                        <th className="px-4 py-3 text-center font-bold bg-slate-100">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    <tr className="bg-white">
                                        <td className="px-4 py-4 font-bold text-slate-700 sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">% Keuangan</td>
                                        {keuangan.map((v, i) => (
                                            <td key={i} className="px-1 py-4">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={v || ''}
                                                    onChange={(e) => {
                                                        const next = [...keuangan]
                                                        next[i] = Number(e.target.value) || 0
                                                        setKeuangan(next)
                                                    }}
                                                    className="w-14 text-center mx-auto block px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none tabular-nums"
                                                />
                                            </td>
                                        ))}
                                        <td className={`px-4 py-4 text-center font-bold bg-slate-50 ${totalKeu === 100 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {totalKeu}%
                                        </td>
                                    </tr>
                                    <tr className="bg-white">
                                        <td className="px-4 py-4 font-bold text-slate-700 sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">% Fisik</td>
                                        {fisik.map((v, i) => (
                                            <td key={i} className="px-1 py-4">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={v || ''}
                                                    onChange={(e) => {
                                                        const next = [...fisik]
                                                        next[i] = Number(e.target.value) || 0
                                                        setFisik(next)
                                                    }}
                                                    className="w-14 text-center mx-auto block px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none tabular-nums"
                                                />
                                            </td>
                                        ))}
                                        <td className={`px-4 py-4 text-center font-bold bg-slate-50 ${totalFis === 100 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {totalFis}%
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between mt-12 pt-6 border-t border-slate-100">
                    <button
                        onClick={() => step > 0 && setStep(step - 1)}
                        disabled={step === 0 || submitting}
                        className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        Kembali
                    </button>
                    <button
                        onClick={nextStep}
                        disabled={submitting}
                        className="inline-flex items-center gap-2 px-8 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20 disabled:opacity-70"
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Menyimpan...
                            </>
                        ) : step === 2 ? (
                            'Simpan Paket Pekerjaan'
                        ) : (
                            <>
                                Lanjutkan
                                <ChevronRight size={18} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div >
    )
}

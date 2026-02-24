import { useState } from 'react'
import { Check, ChevronRight, Search } from 'lucide-react'

const steps = ['Profil Paket', 'Mapping Anggaran', 'Target Bulanan']
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

// Mock SAKTI accounts for Step 2
const mockAkun = [
    { id: '1', kode: '521211', uraian: 'Belanja Bahan', pagu: 500_000_000 },
    { id: '2', kode: '524111', uraian: 'Belanja Perjalanan Dinas', pagu: 300_000_000 },
    { id: '3', kode: '522111', uraian: 'Belanja Jasa Narasumber', pagu: 200_000_000 },
    { id: '4', kode: '523111', uraian: 'Belanja Pemeliharaan', pagu: 150_000_000 },
]

function formatCurrency(v: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)
}

export default function PaketPage() {
    const [step, setStep] = useState(0)
    const [nama, setNama] = useState('')
    const [kasatker, setKasatker] = useState('')
    const [lokasi, setLokasi] = useState('')
    const [pagu, setPagu] = useState('')
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [search, setSearch] = useState('')
    const [selectedAkun, setSelectedAkun] = useState<string[]>([])
    const [keuangan, setKeuangan] = useState<number[]>(Array(12).fill(0))
    const [fisik, setFisik] = useState<number[]>(Array(12).fill(0))

    const validateStep1 = () => {
        const e: Record<string, string> = {}
        if (!nama.trim()) e.nama = 'Nama Paket wajib diisi'
        if (!kasatker.trim()) e.kasatker = 'Kasatker wajib diisi'
        if (!lokasi.trim()) e.lokasi = 'Lokasi wajib diisi'
        if (!pagu.trim()) e.pagu = 'Pagu Paket wajib diisi'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const nextStep = () => {
        if (step === 0 && !validateStep1()) return
        if (step < 2) setStep(step + 1)
    }

    const filteredAkun = mockAkun.filter(
        (a) => a.kode.includes(search) || a.uraian.toLowerCase().includes(search.toLowerCase())
    )

    const totalKeu = keuangan.reduce((a, b) => a + b, 0)
    const totalFis = fisik.reduce((a, b) => a + b, 0)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Tambah Paket Proyek Baru</h1>
                <p className="text-sm text-slate-500 mt-1">Form Wizard - Manajemen Paket Pekerjaan</p>
            </div>

            {/* Horizontal Stepper */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-center mb-8">
                    {steps.map((s, i) => (
                        <div key={s} className="flex items-center">
                            <div className="flex items-center gap-2">
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${i < step ? 'bg-green-500 text-white' :
                                            i === step ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30' :
                                                'bg-slate-200 text-slate-500'
                                        }`}
                                >
                                    {i < step ? <Check size={16} /> : i + 1}
                                </div>
                                <span className={`text-sm font-medium ${i === step ? 'text-primary-700' : 'text-slate-400'}`}>
                                    {s}
                                </span>
                            </div>
                            {i < steps.length - 1 && (
                                <ChevronRight size={20} className="mx-4 text-slate-300" />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step 1: Basic Info */}
                {step === 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                        {[
                            { label: 'Nama Paket', value: nama, set: setNama, key: 'nama', type: 'text' },
                            { label: 'Kasatker', value: kasatker, set: setKasatker, key: 'kasatker', type: 'text' },
                            { label: 'Lokasi', value: lokasi, set: setLokasi, key: 'lokasi', type: 'text' },
                            { label: 'Pagu Paket (Rp)', value: pagu, set: setPagu, key: 'pagu', type: 'number' },
                        ].map((field) => (
                            <div key={field.key}>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
                                <input
                                    type={field.type}
                                    value={field.value}
                                    onChange={(e) => { field.set(e.target.value); setErrors({ ...errors, [field.key]: '' }) }}
                                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${errors[field.key] ? 'border-red-400 bg-red-50' : 'border-slate-300'
                                        }`}
                                />
                                {errors[field.key] && (
                                    <p className="text-xs text-red-500 mt-1">{errors[field.key]}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Step 2: SAKTI Mapping */}
                {step === 1 && (
                    <div className="max-w-3xl mx-auto space-y-4">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Cari kode akun atau uraian..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-left text-slate-500 font-medium">
                                        <th className="px-4 py-2 w-12"></th>
                                        <th className="px-4 py-2">Kode</th>
                                        <th className="px-4 py-2">Uraian</th>
                                        <th className="px-4 py-2 text-right">Pagu</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredAkun.map((akun) => (
                                        <tr key={akun.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedAkun.includes(akun.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedAkun([...selectedAkun, akun.id])
                                                        else setSelectedAkun(selectedAkun.filter((id) => id !== akun.id))
                                                    }}
                                                    className="accent-primary-600"
                                                />
                                            </td>
                                            <td className="px-4 py-2 font-mono text-primary-600">{akun.kode}</td>
                                            <td className="px-4 py-2 text-slate-700">{akun.uraian}</td>
                                            <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(akun.pagu)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-sm text-slate-500">{selectedAkun.length} akun dipilih</p>
                    </div>
                )}

                {/* Step 3: Monthly Target Grid */}
                {step === 2 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border border-slate-200 rounded-lg">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 font-medium">
                                    <th className="px-3 py-2 text-left sticky left-0 bg-slate-50">Target</th>
                                    {months.map((m) => (
                                        <th key={m} className="px-3 py-2 text-center">{m}</th>
                                    ))}
                                    <th className="px-3 py-2 text-center font-bold">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-t border-slate-200">
                                    <td className="px-3 py-2 font-medium text-slate-700 sticky left-0 bg-white">% Keuangan</td>
                                    {keuangan.map((v, i) => (
                                        <td key={i} className="px-1 py-1">
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
                                                className="w-14 text-center px-1 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 tabular-nums"
                                            />
                                        </td>
                                    ))}
                                    <td className={`px-3 py-2 text-center font-bold ${totalKeu === 100 ? 'text-green-600' : 'text-red-500'}`}>
                                        {totalKeu}%
                                    </td>
                                </tr>
                                <tr className="border-t border-slate-200">
                                    <td className="px-3 py-2 font-medium text-slate-700 sticky left-0 bg-white">% Fisik</td>
                                    {fisik.map((v, i) => (
                                        <td key={i} className="px-1 py-1">
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
                                                className="w-14 text-center px-1 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 tabular-nums"
                                            />
                                        </td>
                                    ))}
                                    <td className={`px-3 py-2 text-center font-bold ${totalFis === 100 ? 'text-green-600' : 'text-red-500'}`}>
                                        {totalFis}%
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100">
                    <button
                        onClick={() => step > 0 && setStep(step - 1)}
                        disabled={step === 0}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        Kembali
                    </button>
                    <button
                        onClick={nextStep}
                        className="px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
                    >
                        {step === 2 ? 'Simpan Paket' : 'Lanjutkan'}
                    </button>
                </div>
            </div>
        </div>
    )
}

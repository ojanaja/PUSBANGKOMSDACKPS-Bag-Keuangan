import { useState } from 'react'
import { Upload, Trash2, FileText, Image, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'

const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const tabs = ['Rincian Proyek', 'Progres Lapangan', 'Manajemen Dokumen']

// Mock uploaded docs
const mockDocs: Record<number, { id: string; name: string; type: string; size: string; date: string }[]> = {
    0: [
        { id: '1', name: 'Kwitansi_Jan_2026.pdf', type: 'PDF', size: '245 KB', date: '15 Jan 2026' },
        { id: '2', name: 'Foto_Progress_0persen.jpg', type: 'JPG', size: '1.2 MB', date: '20 Jan 2026' },
    ],
    1: [
        { id: '3', name: 'BAST_Feb_2026.pdf', type: 'PDF', size: '380 KB', date: '28 Feb 2026' },
    ],
}

export default function ProgresPage() {
    const [activeTab, setActiveTab] = useState(1)
    const [expandedMonth, setExpandedMonth] = useState<number | null>(0)
    const [realisasi, setRealisasi] = useState<number[]>(Array(12).fill(0))
    const [saving, setSaving] = useState<number | null>(null)

    const handleRealisasiChange = (index: number, value: number) => {
        const next = [...realisasi]
        next[index] = value
        setRealisasi(next)
        setSaving(index)
        setTimeout(() => setSaving(null), 1000) // Simulate auto-save
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        Pengadaan Alat Praktik Lab Komputer
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Detail Paket & Update Progres</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                    Sedang Berjalan
                </span>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
                {tabs.map((tab, i) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(i)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === i
                                ? 'bg-white text-primary-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                {/* Tab 0: Rincian Proyek */}
                {activeTab === 0 && (
                    <div className="p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">Informasi Proyek</h2>
                        {[
                            { label: 'Nama Paket', value: 'Pengadaan Alat Praktik Lab Komputer' },
                            { label: 'Kasatker', value: 'Pusbangkom SDM Aparatur CKP' },
                            { label: 'Lokasi', value: 'Jakarta Selatan' },
                            { label: 'Pagu', value: 'Rp 1.200.000.000' },
                            { label: 'PPK', value: 'Budi Santoso, S.T., M.M.' },
                        ].map(({ label, value }) => (
                            <div key={label} className="grid grid-cols-3 gap-4 py-2 border-b border-slate-100">
                                <span className="text-sm text-slate-500 font-medium">{label}</span>
                                <span className="col-span-2 text-sm text-slate-800">{value}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tab 1: Progres Lapangan */}
                {activeTab === 1 && (
                    <div className="p-6">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">Input Realisasi Fisik Bulanan</h2>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-left text-slate-500 font-medium">
                                    <th className="px-4 py-3">Bulan</th>
                                    <th className="px-4 py-3 text-center">% Realisasi Fisik Aktual</th>
                                    <th className="px-4 py-3 w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {months.map((month, i) => (
                                    <tr key={month} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-700">{month}</td>
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="number"
                                                min={0} max={100}
                                                value={realisasi[i] || ''}
                                                onChange={(e) => handleRealisasiChange(i, Number(e.target.value) || 0)}
                                                className="w-20 text-center px-2 py-1 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none tabular-nums"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            {saving === i && (
                                                <Loader2 size={16} className="text-primary-500 animate-spin" />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab 2: Manajemen Dokumen */}
                {activeTab === 2 && (
                    <div className="p-6 space-y-2">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">Manajemen Dokumen Bukti</h2>
                        {months.map((month, i) => (
                            <div key={month} className="border border-slate-200 rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setExpandedMonth(expandedMonth === i ? null : i)}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                                >
                                    <span className="text-sm font-medium text-slate-700">{month}</span>
                                    <div className="flex items-center gap-2">
                                        {mockDocs[i] && (
                                            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                                                {mockDocs[i].length} file
                                            </span>
                                        )}
                                        {expandedMonth === i ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </div>
                                </button>
                                {expandedMonth === i && (
                                    <div className="p-4 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Dokumen Keuangan */}
                                            <div className="border border-slate-200 rounded-lg p-4">
                                                <h4 className="text-sm font-semibold text-slate-700 mb-3">Dokumen Keuangan</h4>
                                                {(mockDocs[i] || []).filter((d) => d.type === 'PDF').map((doc) => (
                                                    <div key={doc.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                                                        <FileText size={20} className="text-red-500 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-slate-700 truncate">{doc.name}</p>
                                                            <p className="text-xs text-slate-400">{doc.size} • {doc.date}</p>
                                                        </div>
                                                        <button className="p-1 text-slate-400 hover:text-red-500">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium">
                                                    <Upload size={14} /> + Upload Bukti
                                                </button>
                                            </div>

                                            {/* Dokumen Fisik */}
                                            <div className="border border-slate-200 rounded-lg p-4">
                                                <h4 className="text-sm font-semibold text-slate-700 mb-3">Dokumen Fisik/Teknis</h4>
                                                {(mockDocs[i] || []).filter((d) => d.type === 'JPG').map((doc) => (
                                                    <div key={doc.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                                                        <Image size={20} className="text-blue-500 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-slate-700 truncate">{doc.name}</p>
                                                            <p className="text-xs text-slate-400">{doc.size} • {doc.date}</p>
                                                        </div>
                                                        <button className="p-1 text-slate-400 hover:text-red-500">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium">
                                                    <Upload size={14} /> + Upload Bukti
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

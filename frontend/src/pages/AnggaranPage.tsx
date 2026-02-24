import { useState } from 'react'
import { Upload, ChevronDown, ChevronRight, X } from 'lucide-react'

// Mock tree data
const mockTree = [
    {
        id: '1',
        kode: 'WA.7769',
        uraian: 'Penyelenggaraan Pelatihan SDM Aparatur',
        pagu: 5_000_000_000,
        realisasi: 2_500_000_000,
        children: [
            {
                id: '1-1',
                kode: '100.0A',
                uraian: 'Penyusunan Kurikulum Pelatihan',
                pagu: 1_000_000_000,
                realisasi: 600_000_000,
                children: [
                    { id: '1-1-1', kode: '521211', uraian: 'Belanja Bahan', pagu: 500_000_000, realisasi: 300_000_000 },
                    { id: '1-1-2', kode: '524111', uraian: 'Belanja Perjalanan Dinas', pagu: 500_000_000, realisasi: 300_000_000 },
                ],
            },
            {
                id: '1-2',
                kode: '100.0B',
                uraian: 'Pelaksanaan Pelatihan Teknis',
                pagu: 4_000_000_000,
                realisasi: 1_900_000_000,
                children: [
                    { id: '1-2-1', kode: '521211', uraian: 'Belanja Bahan Pelatihan', pagu: 2_000_000_000, realisasi: 1_000_000_000 },
                    { id: '1-2-2', kode: '522111', uraian: 'Belanja Jasa Narasumber', pagu: 2_000_000_000, realisasi: 900_000_000 },
                ],
            },
        ],
    },
]

function formatCurrency(v: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)
}

interface TreeNode {
    id: string; kode: string; uraian: string; pagu: number; realisasi: number; children?: TreeNode[]
}

function TreeRow({ node, level = 0 }: { node: TreeNode; level?: number }) {
    const [open, setOpen] = useState(level === 0)
    const hasChildren = node.children && node.children.length > 0
    const sisa = node.pagu - node.realisasi

    return (
        <>
            <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3" style={{ paddingLeft: `${24 + level * 24}px` }}>
                    <div className="flex items-center gap-2">
                        {hasChildren ? (
                            <button onClick={() => setOpen(!open)} className="text-slate-400 hover:text-slate-600">
                                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                        ) : (
                            <span className="w-4" />
                        )}
                        <span className="font-mono text-xs text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">{node.kode}</span>
                        <span className="text-sm text-slate-700">{node.uraian}</span>
                    </div>
                </td>
                <td className="px-6 py-3 text-right text-sm tabular-nums">{formatCurrency(node.pagu)}</td>
                <td className="px-6 py-3 text-right text-sm tabular-nums">{formatCurrency(node.realisasi)}</td>
                <td className={`px-6 py-3 text-right text-sm tabular-nums font-semibold ${sisa < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                    {formatCurrency(sisa)}
                </td>
            </tr>
            {open && hasChildren && node.children!.map((child) => (
                <TreeRow key={child.id} node={child} level={level + 1} />
            ))}
        </>
    )
}

export default function AnggaranPage() {
    const [showImportModal, setShowImportModal] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Integrasi Data Anggaran</h1>
                    <p className="text-sm text-slate-500 mt-1">Anggaran Data Center</p>
                </div>
                <button
                    onClick={() => setShowImportModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
                >
                    <Upload size={16} />
                    + Import Laporan Bulanan
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-sm text-slate-500 font-medium">Total Pagu DIPA</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(5_000_000_000)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-sm text-slate-500 font-medium">Total Realisasi SP2D</p>
                    <p className="text-2xl font-bold text-primary-600 mt-1">{formatCurrency(2_500_000_000)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-sm text-slate-500 font-medium">Sinkronisasi Terakhir</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">24 Feb 2026</p>
                    <p className="text-xs text-slate-400">14:00 WIB</p>
                </div>
            </div>

            {/* Tree-View Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-800">Hierarki Anggaran</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-left text-slate-500 font-medium">
                                <th className="px-6 py-3">Program / Kegiatan / Akun</th>
                                <th className="px-6 py-3 text-right">Pagu</th>
                                <th className="px-6 py-3 text-right">Realisasi</th>
                                <th className="px-6 py-3 text-right">Sisa</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {mockTree.map((node) => (
                                <TreeRow key={node.id} node={node} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowImportModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-900">Import Laporan Anggaran</h3>
                            <button onClick={() => setShowImportModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => { e.preventDefault(); setIsDragging(false) }}
                            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${isDragging ? 'border-primary-400 bg-primary-50' : 'border-slate-300 hover:border-primary-400'
                                }`}
                        >
                            <Upload size={40} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-sm text-slate-600 font-medium">Drag & drop file Excel/CSV di sini</p>
                            <p className="text-xs text-slate-400 mt-1">atau klik untuk memilih file</p>
                        </div>
                        <p className="text-xs text-slate-400 mt-3">Format: Laporan FA Detail Anggaran (.xlsx / .csv)</p>
                    </div>
                </div>
            )}
        </div>
    )
}

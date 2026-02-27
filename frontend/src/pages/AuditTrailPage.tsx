import { useState } from 'react'
import { History, Search, Loader2, Clock, Layout, FileEdit, Trash2, CheckCircle, Globe } from 'lucide-react'
import { useAuditLogs } from '@/features/audit/application/useAuditLogs'

export default function AuditTrailPage() {
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(0)
    const limit = 20

    const { data, isLoading: loading } = useAuditLogs(page, limit)
    const logs = data?.logs || []
    const total = data?.total || 0

    const getActionIcon = (action: string) => {
        if (action.includes('CREATE')) return <Layout size={16} className="text-emerald-500" />
        if (action.includes('UPDATE')) return <FileEdit size={16} className="text-blue-500" />
        if (action.includes('DELETE')) return <Trash2 size={16} className="text-red-500" />
        if (action.includes('VERIFY')) return <CheckCircle size={16} className="text-purple-500" />
        return <History size={16} className="text-slate-400" />
    }

    const getActionColor = (action: string) => {
        if (action.includes('CREATE')) return 'bg-emerald-50 text-emerald-700 border-emerald-100'
        if (action.includes('UPDATE')) return 'bg-blue-50 text-blue-700 border-blue-100'
        if (action.includes('DELETE')) return 'bg-red-50 text-red-700 border-red-100'
        if (action.includes('VERIFY')) return 'bg-purple-50 text-purple-700 border-purple-100'
        return 'bg-slate-50 text-slate-700 border-slate-100'
    }

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.user_full_name.toLowerCase().includes(search.toLowerCase()) ||
        log.user_username.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Audit Trail</h1>
                    <p className="text-sm text-slate-500 mt-1">Log riwayat aktivitas pengguna dan perubahan data sistem.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Cari aktivitas atau pengguna..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="animate-spin text-primary-600" size={32} />
                            <p className="text-sm text-slate-500">Memuat log aktivitas...</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 italic">
                            Tidak ada data log aktivitas yang ditemukan.
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <caption className="sr-only">Riwayat Audit Aktivitas</caption>
                            <thead>
                                <tr>
                                    <th className="px-6 py-4">Waktu</th>
                                    <th className="px-6 py-4">Pengguna</th>
                                    <th className="px-6 py-4">Aksi</th>
                                    <th className="px-6 py-4">Target</th>
                                    <th className="px-6 py-4">Informasi Tambahan</th>
                                    <th className="px-6 py-4">Metadata</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-slate-600 font-medium">
                                                <Clock size={14} className="text-slate-400" />
                                                {new Date(log.created_at).toLocaleString('id-ID')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">
                                                    {log.user_full_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 leading-none">{log.user_full_name}</p>
                                                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-medium">{log.user_username}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${getActionColor(log.action)}`}>
                                                {getActionIcon(log.action)}
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {log.target_type ? (
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{log.target_type}</span>
                                                    <p className="text-xs text-slate-500 mt-0.5 font-mono">{log.target_id?.substring(0, 8)}...</p>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            {log.details ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {Object.entries(log.details).map(([k, v]: [string, any]) => (
                                                        <span key={k} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                                            <span className="font-bold">{k}:</span> {String(v)}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col gap-1 text-[10px] text-slate-400">
                                                <div className="flex items-center gap-1">
                                                    <Globe size={10} />
                                                    {log.ip_address}
                                                </div>
                                                <div className="truncate max-w-[150px]" title={log.user_agent}>
                                                    {log.user_agent}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm bg-slate-50/30">
                    <p className="text-slate-500 font-medium">
                        Menampilkan {filteredLogs.length} dari {total} entitas log
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(p => p - 1)}
                            className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-all shadow-sm"
                        >
                            Sebelumnya
                        </button>
                        <button
                            disabled={logs.length < 20}
                            onClick={() => setPage(p => p + 1)}
                            className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-all shadow-sm"
                        >
                            Selanjutnya
                        </button>
                    </div>
                </div>
            </div>
        </div >
    )
}

import { Save, Loader2, CheckCircle, XCircle, ShieldCheck, ShieldX } from 'lucide-react'
import type { Target, RealisasiFisik } from '@/features/progres/application/useProgres'
import { MONTHS_LONG } from '@/shared/config/months'

const months = MONTHS_LONG

const verificationLabel: Record<'APPROVED' | 'REJECTED' | 'PENDING', string> = {
    APPROVED: 'Disetujui',
    REJECTED: 'Ditolak',
    PENDING: 'Menunggu'
}

interface ProgresTableTabProps {
    targets: Target[]
    realisasi: RealisasiFisik[]
    isAdmin: boolean
    saving: number | null
    onRealisasiChange: (index: number, field: 'PersenAktual' | 'CatatanKendala', value: string | number) => void
    onSave: (index: number) => void
    onApprove: (idRecord: string) => void
    onReject: (idRecord: string) => void
}

export default function ProgresTableTab({
    targets,
    realisasi,
    isAdmin,
    saving,
    onRealisasiChange,
    onSave,
    onApprove,
    onReject,
}: ProgresTableTabProps) {
    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-primary-500 rounded-full" />
                    Monitoring Progres Fisik Bulanan
                </h2>
                <p className="text-xs text-slate-400">Target otomatis bersumber dari rencana kerja paket</p>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <caption className="sr-only">Monitoring Progres Fisik Bulanan</caption>
                    <thead>
                        <tr>
                            <th className="px-6 py-4">Bulan Operasional</th>
                            <th className="px-6 py-4 text-center">Target Fisik (%)</th>
                            <th className="px-6 py-4 text-center">Realisasi Aktual (%)</th>
                            <th className="px-6 py-4">Catatan Kendala</th>
                            <th className="px-6 py-4 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {months.map((month, i) => {
                            const target = targets.find(t => t.Bulan === i + 1)?.PersenFisik || 0
                            const rec = realisasi[i]
                            const actual = rec?.PersenAktual || 0
                            const deviasi = actual - target

                            return (
                                <tr key={month} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-slate-700">{month}</p>
                                        {rec?.VerificationStatus && rec.VerificationStatus !== 'PENDING' && (
                                            <div className={`mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${rec.VerificationStatus === 'APPROVED' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {rec.VerificationStatus === 'APPROVED' ? <ShieldCheck size={12} /> : <ShieldX size={12} />}
                                                {verificationLabel[rec.VerificationStatus]} oleh {rec.VerifiedByFullName}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center font-medium text-slate-600 bg-slate-50/50">{target}%</td>
                                    <td className="px-6 py-4 text-center">
                                        <input
                                            type="number"
                                            min={0} max={100}
                                            value={actual || ''}
                                            disabled={rec?.VerificationStatus === 'APPROVED' && !isAdmin}
                                            onChange={(e) => onRealisasiChange(i, 'PersenAktual', Number(e.target.value) || 0)}
                                            className={`w-20 text-center px-2 py-1.5 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all ${deviasi < 0 && actual > 0 ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-300'}`}
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <input
                                            type="text"
                                            placeholder="Opsional..."
                                            value={realisasi[i]?.CatatanKendala || ''}
                                            onChange={(e) => onRealisasiChange(i, 'CatatanKendala', e.target.value)}
                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => onSave(i)}
                                                disabled={saving === i || (rec?.VerificationStatus === 'APPROVED' && !isAdmin)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${saving === i
                                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200'
                                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                title="Simpan Progres"
                                            >
                                                {saving === i ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                <span>Simpan</span>
                                            </button>

                                            {isAdmin && rec?.ID && rec.VerificationStatus === 'PENDING' && (
                                                <>
                                                    <button
                                                        onClick={() => onApprove(rec.ID!)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-medium transition-colors border border-emerald-200"
                                                        title="Setujui Progres"
                                                    >
                                                        <CheckCircle size={14} />
                                                        <span>Setuju</span>
                                                    </button>
                                                    <button
                                                        onClick={() => onReject(rec.ID!)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors border border-red-200"
                                                        title="Tolak Progres"
                                                    >
                                                        <XCircle size={14} />
                                                        <span>Tolak</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div >
    )
}

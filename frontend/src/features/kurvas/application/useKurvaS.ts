import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/shared/api/httpClient'

export interface PaketDetail {
    ID: string
    NamaPaket: string
    Kasatker: string
}

export interface Target {
    Bulan: number
    PersenKeuangan: number
    PersenFisik: number
}

export interface RealisasiFisik {
    Bulan: number
    PersenAktual: number
    CatatanKendala: string
}

interface KurvaSResponse {
    paket?: PaketDetail
    targets?: Target[]
    realisasi?: RealisasiFisik[]
}

import { MONTHS_LONG, MONTHS_SHORT } from '@/shared/config/months'
const monthsLong = MONTHS_LONG
const monthsShort = MONTHS_SHORT

export function useKurvaS(id: string | undefined) {
    return useQuery({
        queryKey: ['kurvas', id],
        queryFn: async () => {
            if (!id) throw new Error('ID tidak valid')
            const data = await apiGet<KurvaSResponse>(`/paket/${id}`)

            const paket: PaketDetail = data.paket || (data as unknown as PaketDetail)
            const targets: Target[] = data.targets || []
            const realisasi: RealisasiFisik[] = data.realisasi || []

            let cumRencanaKeu = 0
            let cumRencanaFis = 0
            let cumRealFis = 0

            const chartData = monthsShort.map((m, i) => {
                const monthNum = i + 1
                const t = targets.find(target => target.Bulan === monthNum)
                const r = realisasi.find(real => real.Bulan === monthNum)

                cumRencanaKeu += t ? Number(t.PersenKeuangan) : 0
                cumRencanaFis += t ? Number(t.PersenFisik) : 0

                const hasData = r && (r.PersenAktual > 0 || r.CatatanKendala)
                if (hasData || monthNum <= new Date().getMonth() + 1) {
                    cumRealFis += r ? Number(r.PersenAktual) : 0
                }

                const isFuture = monthNum > new Date().getMonth() + 1 && !hasData

                return {
                    bulan: m,
                    bulanFull: monthsLong[i],
                    rencanaKeu: Math.min(100, cumRencanaKeu),
                    rencanaFisik: Math.min(100, cumRencanaFis),
                    realisasiFisik: isFuture ? null : Math.min(100, cumRealFis),
                    kendala: r?.CatatanKendala || ''
                }
            })

            return { paket, chartData }
        },
        enabled: !!id
    })
}

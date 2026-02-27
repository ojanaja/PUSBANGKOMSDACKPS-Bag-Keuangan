import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/shared/api/httpClient'
import type { AnggaranTreeRow } from '@/features/anggaran/application/useAnggaran'

export interface AnggaranAkun {
    AkunID: string
    AkunKode: string
    AkunUraian: string
    Pagu: number
}

export interface CreatePaketPayload {
    nama: string
    kasatker: string
    lokasi: string
    pagu: number
    akun_ids: string[]
    target_keuangan: number[]
    target_fisik: number[]
}

export function usePaketWizard(tahun: number) {
    const queryClient = useQueryClient()

    const akunQuery = useQuery({
        queryKey: ['anggaran-tree', tahun],
        queryFn: async () => {
            const data = await apiGet<AnggaranTreeRow[]>(`/anggaran/tree?tahun=${tahun}`)
            const uniqueAkun = new Map<string, AnggaranAkun>()
            if (Array.isArray(data)) {
                data.forEach((row) => {
                    if (row.AkunID && row.AkunKode && row.AkunUraian) {
                        uniqueAkun.set(row.AkunID, {
                            AkunID: row.AkunID,
                            AkunKode: row.AkunKode,
                            AkunUraian: row.AkunUraian,
                            Pagu: row.Pagu
                        })
                    }
                })
            }
            return Array.from(uniqueAkun.values())
        },
        staleTime: 5 * 60 * 1000,
    })

    const createMutation = useMutation({
        mutationFn: async (payload: CreatePaketPayload) => {
            const body = {
                nama_paket: payload.nama,
                kasatker: payload.kasatker,
                lokasi: payload.lokasi,
                pagu_paket: payload.pagu,
                akun_ids: payload.akun_ids,
                targets: payload.target_keuangan.map((_, i) => ({
                    bulan: i + 1,
                    persen_keuangan: payload.target_keuangan[i],
                    persen_fisik: payload.target_fisik[i],
                })),
            }
            return apiPost('/paket', body)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['paket'] })
            queryClient.invalidateQueries({ queryKey: ['pakets'] })
        }
    })

    return {
        akunQuery,
        createMutation
    }
}

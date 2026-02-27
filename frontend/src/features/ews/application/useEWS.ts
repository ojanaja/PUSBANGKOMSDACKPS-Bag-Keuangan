import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/shared/api/httpClient'

export interface EWSItem {
    paket_id: string
    nama_paket: string
    status: 'TIDAK_LENGKAP' | 'PERINGATAN' | 'LENGKAP'
    alasan: string
    deviasi_fisik: number
    realisasi_keuangan_persen: number
    realisasi_fisik_persen: number
}

export function useEWS(tahun: number) {
    return useQuery<EWSItem[]>({
        queryKey: ['ews', tahun],
        queryFn: () => apiGet<EWSItem[]>(`/dashboard/ews?tahun=${tahun}`)
    })
}

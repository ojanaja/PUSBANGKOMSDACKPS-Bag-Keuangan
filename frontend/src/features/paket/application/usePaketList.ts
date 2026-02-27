import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut, apiDelete } from '@/shared/api/httpClient'

export interface Paket {
    ID: string
    NamaPaket: string
    Kasatker: string
    Lokasi: string
    PaguPaket: number
    PaguAnggaran: number
    RealisasiAnggaran: number
    RealisasiFisik: number
}

export function usePaketList(tahun: number) {
    const queryClient = useQueryClient()

    const query = useQuery<Paket[]>({
        queryKey: ['pakets', tahun],
        queryFn: () => apiGet<Paket[]>(`/paket?tahun=${tahun}`)
    })

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: Partial<Paket> }) => {
            return apiPut(`/paket/${id}`, {
                nama_paket: data.NamaPaket,
                kasatker: data.Kasatker,
                lokasi: data.Lokasi,
                pagu_paket: Number(data.PaguPaket)
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pakets', tahun] })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiDelete(`/paket/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pakets', tahun] })
        }
    })

    return {
        query,
        updateMutation,
        deleteMutation
    }
}

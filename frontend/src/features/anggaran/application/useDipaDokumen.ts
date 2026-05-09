import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '@/shared/api/httpClient'

export interface DipaDokumenItem {
    id: string
    tahun_anggaran: number
    bulan: number
    revisi: number
    file_hash_sha256: string
    original_name: string
    mime_type: string
    file_size_bytes: number
    created_at: string
    uploaded_by: string
    uploaded_by_name: string
}

interface GetDipaDocumentsParams {
    tahun: number
    bulan?: number
    revisi?: number
}

export function useDipaDokumen(params: GetDipaDocumentsParams) {
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: ['dipa-dokumen', params.tahun, params.bulan, params.revisi],
        queryFn: async () => {
            const searchParams = new URLSearchParams({ tahun: String(params.tahun) })
            if (params.bulan !== undefined && params.bulan > 0) {
                searchParams.set('bulan', String(params.bulan))
            }
            if (params.revisi !== undefined && params.revisi >= 0) {
                searchParams.set('revisi', String(params.revisi))
            }
            const data = await apiGet<DipaDokumenItem[]>(`/anggaran/dipa/documents?${searchParams}`)
            return data || []
        }
    })

    const uploadMutation = useMutation({
        mutationFn: async ({ file, tahun_anggaran, bulan, revisi }: { file: File, tahun_anggaran: number, bulan: number, revisi: number }) => {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('tahun_anggaran', String(tahun_anggaran))
            formData.append('bulan', String(bulan))
            formData.append('revisi', String(revisi))
            return apiPost<{ message: string, id: string }>('/anggaran/dipa/upload', formData)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dipa-dokumen'] })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (documentId: string) => {
            return apiDelete(`/anggaran/dipa/documents/${documentId}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dipa-dokumen'] })
        }
    })

    return { query, uploadMutation, deleteMutation }
}

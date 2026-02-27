import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/api/httpClient'
import { processImageFile } from '@/lib/fileUtils'

export interface PaketDetail {
    ID: string
    NamaPaket: string
    Kasatker: string
    Lokasi: string
    PaguPaket: number
    Status: string
}

export interface Target {
    Bulan: number
    PersenKeuangan: number
    PersenFisik: number
}

export interface RealisasiFisik {
    ID?: string
    Bulan: number
    PersenAktual: number
    CatatanKendala: string
    VerificationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'
    VerifiedByFullName?: string
    RejectionReason?: string
}

export interface UploadDocumentPayload {
    paketId: string
    bulan: number
    kategori: string
    files: File[]
    onProgress?: (progress: string) => void
}

export interface DocumentItem {
    ID: string
    id?: string
    Bulan: number
    bulan?: number
    kategori?: string
    Kategori?: string
    original_name?: string
    OriginalName?: string
    file_size_bytes?: number
    FileSizeBytes?: number
    mime_type?: string
    MimeType?: string
    verification_status?: string
    VerificationStatus?: string
    verified_by_full_name?: string
    VerifiedByFullName?: string
    rejection_reason?: string
    RejectionReason?: string
}

interface PaketDetailResponse {
    paket?: PaketDetail
    targets?: Target[]
    realisasi?: RealisasiFisik[]
}

export function useProgres(id: string | undefined) {
    const queryClient = useQueryClient()

    const detailQuery = useQuery({
        queryKey: ['paket', id],
        queryFn: async () => {
            if (!id) throw new Error('ID tidak valid')
            const data = await apiGet<PaketDetailResponse>(`/paket/${id}`)

            const paket: PaketDetail = data.paket || (data as unknown as PaketDetail)
            const targets: Target[] = data.targets || []

            const realisasi: RealisasiFisik[] = Array.from({ length: 12 }, (_, i) => ({
                Bulan: i + 1,
                PersenAktual: 0,
                CatatanKendala: ''
            }))

            if (data.realisasi) {
                data.realisasi.forEach((r) => {
                    realisasi[r.Bulan - 1] = {
                        ID: r.ID,
                        Bulan: r.Bulan,
                        PersenAktual: r.PersenAktual,
                        CatatanKendala: r.CatatanKendala || '',
                        VerificationStatus: r.VerificationStatus || 'PENDING',
                        VerifiedByFullName: r.VerifiedByFullName,
                        RejectionReason: r.RejectionReason
                    }
                })
            }

            return { paket, targets, realisasi }
        },
        enabled: !!id
    })

    const documentsQuery = useQuery({
        queryKey: ['documents', id],
        queryFn: async () => {
            if (!id) throw new Error('ID tidak valid')
            const data = await apiGet<DocumentItem[]>(`/paket/${id}/documents`)

            const newDocs: Record<number, DocumentItem[]> = {}
            if (Array.isArray(data)) {
                data.forEach((d) => {
                    const bulan = d.Bulan ?? d.bulan ?? 0
                    const m = bulan - 1
                    if (m < 0) return
                    if (!newDocs[m]) newDocs[m] = []
                    newDocs[m].push(d)
                })
            }
            return newDocs
        },
        enabled: !!id
    })

    const saveRealisasiMutation = useMutation({
        mutationFn: (item: RealisasiFisik) =>
            apiPut(`/paket/${id}/realisasi`, {
                bulan: item.Bulan,
                persen_aktual: item.PersenAktual,
                catatan_kendala: item.CatatanKendala
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['paket', id] })
        }
    })

    const uploadDocumentMutation = useMutation({
        mutationFn: async ({ paketId, bulan, kategori, files, onProgress }: UploadDocumentPayload) => {
            for (let i = 0; i < files.length; i++) {
                let file = files[i]
                onProgress?.(`${i + 1}/${files.length}`)

                if (file.type.startsWith('image/')) {
                    file = await processImageFile(file)
                }

                const formData = new FormData()
                formData.append('file', file)
                formData.append('paket_id', paketId)
                formData.append('bulan', String(bulan))
                formData.append('kategori', kategori)
                formData.append('jenis_dokumen', kategori === 'FISIK' ? 'FOTO' : 'DOKUMEN')

                await apiPost('/documents', formData)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents', id] })
        }
    })

    const verifyMutation = useMutation({
        mutationFn: ({ idRecord, type, status, reason }: { idRecord: string, type: 'realisasi' | 'document', status: 'APPROVED' | 'REJECTED', reason?: string }) =>
            apiPost(`/verification/${type}/${idRecord}`, { status, rejection_reason: reason }),
        onSuccess: (_, variables) => {
            if (variables.type === 'realisasi') {
                queryClient.invalidateQueries({ queryKey: ['paket', id] })
            } else {
                queryClient.invalidateQueries({ queryKey: ['documents', id] })
            }
        }
    })

    const deleteDocumentMutation = useMutation({
        mutationFn: (docId: string) => apiDelete(`/documents/${docId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents', id] })
        }
    })

    return {
        detailQuery,
        documentsQuery,
        saveRealisasiMutation,
        uploadDocumentMutation,
        verifyMutation,
        deleteDocumentMutation
    }
}

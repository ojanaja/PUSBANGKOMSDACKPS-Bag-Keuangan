import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useProgres } from '@/features/progres/application/useProgres'
import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/api/httpClient'
import { processImageFile } from '@/lib/fileUtils'

vi.mock('@/shared/api/httpClient', () => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPut: vi.fn(),
    apiDelete: vi.fn(),
}))

vi.mock('@/lib/fileUtils', () => ({
    processImageFile: vi.fn(),
}))

function createWrapperAndClient() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })

    return {
        queryClient,
        wrapper: ({ children }: PropsWithChildren) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
    }
}

describe('useProgres', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(processImageFile).mockImplementation(async (f) => f)
        vi.mocked(apiGet).mockImplementation(async (path: string) => {
            if (path === '/paket/p-1') {
                return {
                    paket: { ID: 'p-1', NamaPaket: 'Paket 1', Kasatker: 'Satker', Lokasi: 'Jakarta', PaguPaket: 1000, Status: 'ACTIVE' },
                    targets: [{ Bulan: 1, PersenKeuangan: 10, PersenFisik: 5 }],
                    realisasi: [{ ID: 'r-1', Bulan: 1, PersenAktual: 7, CatatanKendala: 'OK' }],
                }
            }

            if (path === '/paket/p-1/documents') {
                return [
                    { ID: 'd1', Bulan: 1, Kategori: 'FISIK' },
                    { ID: 'd2', bulan: 2, kategori: 'KEUANGAN' },
                    { ID: 'd3', bulan: 0, kategori: 'KEUANGAN' },
                ]
            }

            return []
        })
        vi.mocked(apiPost).mockResolvedValue({ ok: true })
        vi.mocked(apiPut).mockResolvedValue({ ok: true })
        vi.mocked(apiDelete).mockResolvedValue({ ok: true })
    })

    it('maps detail data and groups documents by month index', async () => {
        const { wrapper } = createWrapperAndClient()
        const { result } = renderHook(() => useProgres('p-1'), { wrapper })

        await waitFor(() => expect(result.current.detailQuery.isSuccess).toBe(true))
        await waitFor(() => expect(result.current.documentsQuery.isSuccess).toBe(true))

        expect(apiGet).toHaveBeenCalledWith('/paket/p-1')
        expect(apiGet).toHaveBeenCalledWith('/paket/p-1/documents')

        const detail = result.current.detailQuery.data
        expect(detail?.paket.ID).toBe('p-1')
        expect(detail?.realisasi).toHaveLength(12)
        expect(detail?.realisasi[0].PersenAktual).toBe(7)

        const docs = result.current.documentsQuery.data
        expect(docs?.[0]).toHaveLength(1)
        expect(docs?.[1]).toHaveLength(1)
        expect(docs?.[-1 as unknown as number]).toBeUndefined()
    })

    it('uploads documents with progress and image processing', async () => {
        const onProgress = vi.fn()
        const { queryClient, wrapper } = createWrapperAndClient()
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderHook(() => useProgres('p-1'), { wrapper })

        const imageFile = new File(['img'], 'a.png', { type: 'image/png' })
        const docFile = new File(['doc'], 'a.pdf', { type: 'application/pdf' })

        await act(async () => {
            await result.current.uploadDocumentMutation.mutateAsync({
                paketId: 'p-1',
                bulan: 1,
                kategori: 'FISIK',
                files: [imageFile, docFile],
                onProgress,
            })
        })

        expect(processImageFile).toHaveBeenCalledTimes(1)
        expect(onProgress).toHaveBeenCalledWith('1/2')
        expect(onProgress).toHaveBeenCalledWith('2/2')
        expect(apiPost).toHaveBeenCalledTimes(2)
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['documents', 'p-1'] })
    })

    it('runs verify and delete mutations with proper invalidations', async () => {
        const { queryClient, wrapper } = createWrapperAndClient()
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderHook(() => useProgres('p-1'), { wrapper })

        await act(async () => {
            await result.current.verifyMutation.mutateAsync({
                idRecord: 'r-1',
                type: 'realisasi',
                status: 'APPROVED',
            })
        })

        await act(async () => {
            await result.current.verifyMutation.mutateAsync({
                idRecord: 'd-1',
                type: 'document',
                status: 'REJECTED',
                reason: 'Tidak sesuai',
            })
        })

        await act(async () => {
            await result.current.deleteDocumentMutation.mutateAsync('d-1')
        })

        expect(apiPost).toHaveBeenCalledWith('/verification/realisasi/r-1', { status: 'APPROVED', rejection_reason: undefined })
        expect(apiPost).toHaveBeenCalledWith('/verification/document/d-1', { status: 'REJECTED', rejection_reason: 'Tidak sesuai' })
        expect(apiDelete).toHaveBeenCalledWith('/documents/d-1')
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['paket', 'p-1'] })
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['documents', 'p-1'] })
    })

    it('saves realisasi and invalidates paket detail query', async () => {
        const { queryClient, wrapper } = createWrapperAndClient()
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderHook(() => useProgres('p-1'), { wrapper })

        await act(async () => {
            await result.current.saveRealisasiMutation.mutateAsync({
                Bulan: 3,
                PersenAktual: 33,
                CatatanKendala: 'Catatan baru',
            })
        })

        expect(apiPut).toHaveBeenCalledWith('/paket/p-1/realisasi', {
            bulan: 3,
            persen_aktual: 33,
            catatan_kendala: 'Catatan baru',
        })
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['paket', 'p-1'] })
    })

    it('returns query errors when id is undefined and refetch is forced', async () => {
        const { wrapper } = createWrapperAndClient()
        const { result } = renderHook(() => useProgres(undefined), { wrapper })

        await expect(result.current.detailQuery.refetch()).resolves.toMatchObject({ status: 'error' })
        await expect(result.current.documentsQuery.refetch()).resolves.toMatchObject({ status: 'error' })
    })

    it('supports fallback paket detail shape and non-array documents response', async () => {
        vi.mocked(apiGet).mockImplementation(async (path: string) => {
            if (path === '/paket/p-2') {
                return {
                    ID: 'p-2',
                    NamaPaket: 'Paket Fallback',
                    Kasatker: 'Satker',
                    Lokasi: 'Surabaya',
                    PaguPaket: 500,
                    Status: 'ACTIVE',
                }
            }

            if (path === '/paket/p-2/documents') {
                return {} as never
            }

            return []
        })

        const { wrapper } = createWrapperAndClient()
        const { result } = renderHook(() => useProgres('p-2'), { wrapper })

        await waitFor(() => expect(result.current.detailQuery.isSuccess).toBe(true))
        await waitFor(() => expect(result.current.documentsQuery.isSuccess).toBe(true))

        expect(result.current.detailQuery.data?.paket.ID).toBe('p-2')
        expect(result.current.detailQuery.data?.targets).toEqual([])
        expect(result.current.detailQuery.data?.realisasi).toHaveLength(12)
        expect(result.current.documentsQuery.data).toEqual({})
    })

    it('appends multiple documents in the same month bucket', async () => {
        vi.mocked(apiGet).mockImplementation(async (path: string) => {
            if (path === '/paket/p-3') {
                return {
                    paket: { ID: 'p-3', NamaPaket: 'Paket 3', Kasatker: 'Satker', Lokasi: 'Solo', PaguPaket: 100, Status: 'ACTIVE' },
                    targets: [],
                    realisasi: [{ Bulan: 2, PersenAktual: 10, CatatanKendala: '' }],
                }
            }

            if (path === '/paket/p-3/documents') {
                return [
                    { ID: 'd1', Bulan: 2, Kategori: 'FISIK' },
                    { ID: 'd2', bulan: 2, kategori: 'KEUANGAN' },
                    { ID: 'd3' },
                ]
            }

            return []
        })

        const { wrapper } = createWrapperAndClient()
        const { result } = renderHook(() => useProgres('p-3'), { wrapper })

        await waitFor(() => expect(result.current.documentsQuery.isSuccess).toBe(true))
        await waitFor(() => expect(result.current.detailQuery.isSuccess).toBe(true))
        expect(result.current.documentsQuery.data?.[1]).toHaveLength(2)
        expect(result.current.detailQuery.data?.realisasi[1].CatatanKendala).toBe('')
    })

    it('sets jenis dokumen to DOKUMEN for non-FISIK category uploads', async () => {
        const { wrapper } = createWrapperAndClient()
        const { result } = renderHook(() => useProgres('p-1'), { wrapper })

        const file = new File(['doc'], 'evidence.pdf', { type: 'application/pdf' })
        await act(async () => {
            await result.current.uploadDocumentMutation.mutateAsync({
                paketId: 'p-1',
                bulan: 2,
                kategori: 'KEUANGAN',
                files: [file],
            })
        })

        const secondUploadArg = vi.mocked(apiPost).mock.calls.at(-1)?.[1] as FormData
        expect(secondUploadArg.get('jenis_dokumen')).toBe('DOKUMEN')
    })
})

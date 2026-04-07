import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useAnggaran } from '@/features/anggaran/application/useAnggaran'
import { apiGet, apiPost } from '@/shared/api/httpClient'

vi.mock('@/shared/api/httpClient', () => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
}))

function createWrapperAndClient() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })

    const wrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    return { queryClient, wrapper }
}

describe('useAnggaran', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('loads tree data using year-specific query key and endpoint', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce([])
        const { wrapper } = createWrapperAndClient()

        const { result } = renderHook(() => useAnggaran(2026), { wrapper })

        await waitFor(() => {
            expect(result.current.query.isSuccess).toBe(true)
        })

        expect(apiGet).toHaveBeenCalledWith('/anggaran/tree?tahun=2026')
        expect(result.current.query.data).toEqual([])
    })

    it('sends preview file as FormData', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce([])
        vi.mocked(apiPost).mockResolvedValueOnce({
            format_detected: 'fa_detail',
            nodes: [],
            stats: { total_nodes: 0, by_jenis: {} }
        })
        const { wrapper } = createWrapperAndClient()

        const { result } = renderHook(() => useAnggaran(2025), { wrapper })
        const file = new File(['dummy'], 'anggaran.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })

        await act(async () => {
            await result.current.previewMutation.mutateAsync({ file })
        })

        expect(apiPost).toHaveBeenCalledTimes(1)
        expect(apiPost).toHaveBeenCalledWith('/anggaran/preview', expect.any(FormData))

        const formDataArg = vi.mocked(apiPost).mock.calls[0][1] as FormData
        expect(formDataArg.get('file')).toBe(file)
    })

    it('confirmImport sends JSON with tahun_anggaran, bulan, and nodes, then invalidates cache', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce([])
        vi.mocked(apiPost).mockResolvedValueOnce({ nodes_upserted: 3 })
        const { queryClient, wrapper } = createWrapperAndClient()
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useAnggaran(2025), { wrapper })

        const nodes = [{
            temp_id: 'temp-0', parent_temp_id: '', level: 0,
            jenis: 'PROGRAM', kode: '054.01', uraian: 'Test',
            pagu_revisi: '100', lock_pagu: '0',
            realisasi_lalu: '0', realisasi_ini: '50',
            realisasi_sd: '50', persentase: '50', sisa: '50'
        }]

        await act(async () => {
            await result.current.confirmImportMutation.mutateAsync({
                tahun_anggaran: 2025,
                bulan: 3,
                nodes
            })
        })

        expect(apiPost).toHaveBeenCalledTimes(1)
        expect(apiPost).toHaveBeenCalledWith('/anggaran/confirm-import', {
            tahun_anggaran: 2025,
            bulan: 3,
            nodes
        })

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['anggaran'] })
    })

})

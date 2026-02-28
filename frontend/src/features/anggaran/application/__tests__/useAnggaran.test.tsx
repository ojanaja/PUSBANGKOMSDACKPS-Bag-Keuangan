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

    it('uploads import file and invalidates anggaran queries on success', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce([])
        vi.mocked(apiPost).mockResolvedValueOnce({ programs_upserted: 2, akun_upserted: 4 })
        const { queryClient, wrapper } = createWrapperAndClient()
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useAnggaran(2025), { wrapper })
        const file = new File(['dummy'], 'anggaran.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })

        await act(async () => {
            await result.current.importMutation.mutateAsync({ file, tahun: 2025 })
        })

        expect(apiPost).toHaveBeenCalledTimes(1)
        expect(apiPost).toHaveBeenCalledWith('/anggaran/import', expect.any(FormData))

        const formDataArg = vi.mocked(apiPost).mock.calls[0][1] as FormData
        expect(formDataArg.get('file')).toBe(file)
        expect(formDataArg.get('tahun')).toBe('2025')

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['anggaran'] })
    })

    it('posts manual payload and invalidates anggaran queries on success', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce([])
        vi.mocked(apiPost).mockResolvedValueOnce({ ok: true })
        const { queryClient, wrapper } = createWrapperAndClient()
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useAnggaran(2025), { wrapper })
        const payload = { akun: '521111', pagu: 100000 }

        await act(async () => {
            await result.current.manualMutation.mutateAsync(payload)
        })

        expect(apiPost).toHaveBeenCalledWith('/anggaran/manual', payload)
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['anggaran'] })
    })
})

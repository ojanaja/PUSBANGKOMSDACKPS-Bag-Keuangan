import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { usePaketList } from '@/features/paket/application/usePaketList'
import { apiGet, apiPut, apiDelete } from '@/shared/api/httpClient'

vi.mock('@/shared/api/httpClient', () => ({
    apiGet: vi.fn(),
    apiPut: vi.fn(),
    apiDelete: vi.fn(),
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

describe('usePaketList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(apiGet).mockResolvedValue([])
        vi.mocked(apiPut).mockResolvedValue({ ok: true })
        vi.mocked(apiDelete).mockResolvedValue({ ok: true })
    })

    it('fetches paket list by year', async () => {
        const { wrapper } = createWrapperAndClient()

        const { result } = renderHook(() => usePaketList(2026), { wrapper })

        await waitFor(() => expect(result.current.query.isSuccess).toBe(true))

        expect(apiGet).toHaveBeenCalledWith('/paket?tahun=2026')
    })

    it('updates paket and invalidates paket list query', async () => {
        const { queryClient, wrapper } = createWrapperAndClient()
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => usePaketList(2026), { wrapper })

        await act(async () => {
            await result.current.updateMutation.mutateAsync({
                id: 'p-1',
                data: {
                    NamaPaket: 'Paket A',
                    Kasatker: 'Satker A',
                    Lokasi: 'Jakarta',
                    PaguPaket: 1000,
                },
            })
        })

        expect(apiPut).toHaveBeenCalledWith('/paket/p-1', {
            nama_paket: 'Paket A',
            kasatker: 'Satker A',
            lokasi: 'Jakarta',
            pagu_paket: 1000,
        })
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['pakets', 2026] })
    })

    it('deletes paket and invalidates paket list query', async () => {
        const { queryClient, wrapper } = createWrapperAndClient()
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => usePaketList(2026), { wrapper })

        await act(async () => {
            await result.current.deleteMutation.mutateAsync('p-2')
        })

        expect(apiDelete).toHaveBeenCalledWith('/paket/p-2')
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['pakets', 2026] })
    })
})

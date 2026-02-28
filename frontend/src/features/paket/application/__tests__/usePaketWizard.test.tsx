import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { usePaketWizard } from '@/features/paket/application/usePaketWizard'
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

    return {
        queryClient,
        wrapper: ({ children }: PropsWithChildren) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
    }
}

describe('usePaketWizard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(apiGet).mockResolvedValue([])
        vi.mocked(apiPost).mockResolvedValue({ ok: true })
    })

    it('builds unique akun list from anggaran tree rows', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce([
            { AkunID: 'A1', AkunKode: '521111', AkunUraian: 'Belanja 1', Pagu: 10 },
            { AkunID: 'A1', AkunKode: '521111', AkunUraian: 'Belanja 1', Pagu: 20 },
            { AkunID: 'A2', AkunKode: '521112', AkunUraian: 'Belanja 2', Pagu: 30 },
            { AkunID: '', AkunKode: '', AkunUraian: '', Pagu: 0 },
        ])
        const { wrapper } = createWrapperAndClient()

        const { result } = renderHook(() => usePaketWizard(2026), { wrapper })

        await waitFor(() => expect(result.current.akunQuery.isSuccess).toBe(true))

        expect(apiGet).toHaveBeenCalledWith('/anggaran/tree?tahun=2026')
        expect(result.current.akunQuery.data).toEqual([
            { AkunID: 'A1', AkunKode: '521111', AkunUraian: 'Belanja 1', Pagu: 20 },
            { AkunID: 'A2', AkunKode: '521112', AkunUraian: 'Belanja 2', Pagu: 30 },
        ])
    })

    it('creates paket and invalidates related queries', async () => {
        const { queryClient, wrapper } = createWrapperAndClient()
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderHook(() => usePaketWizard(2026), { wrapper })

        await act(async () => {
            await result.current.createMutation.mutateAsync({
                nama: 'Paket Baru',
                kasatker: 'Satker X',
                lokasi: 'Bandung',
                pagu: 100000,
                akun_ids: ['A1'],
                target_keuangan: [10, 20],
                target_fisik: [5, 15],
            })
        })

        expect(apiPost).toHaveBeenCalledWith('/paket', {
            nama_paket: 'Paket Baru',
            kasatker: 'Satker X',
            lokasi: 'Bandung',
            pagu_paket: 100000,
            akun_ids: ['A1'],
            targets: [
                { bulan: 1, persen_keuangan: 10, persen_fisik: 5 },
                { bulan: 2, persen_keuangan: 20, persen_fisik: 15 },
            ],
        })

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['paket'] })
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['pakets'] })
    })

    it('returns empty akun list when API payload is not an array', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce({} as never)
        const { wrapper } = createWrapperAndClient()

        const { result } = renderHook(() => usePaketWizard(2026), { wrapper })

        await waitFor(() => expect(result.current.akunQuery.isSuccess).toBe(true))
        expect(result.current.akunQuery.data).toEqual([])
    })
})

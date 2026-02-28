import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useEWS } from '@/features/ews/application/useEWS'
import { apiGet } from '@/shared/api/httpClient'

vi.mock('@/shared/api/httpClient', () => ({
    apiGet: vi.fn(),
}))

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    })

    return {
        wrapper: ({ children }: PropsWithChildren) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
    }
}

describe('useEWS', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(apiGet).mockResolvedValue([])
    })

    it('fetches ews list by selected year', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce([
            {
                paket_id: 'p1',
                nama_paket: 'Paket 1',
                status: 'PERINGATAN',
                alasan: 'deviasi',
                deviasi_fisik: 5,
                realisasi_keuangan_persen: 30,
                realisasi_fisik_persen: 20,
            },
        ])
        const { wrapper } = createWrapper()

        const { result } = renderHook(() => useEWS(2026), { wrapper })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(apiGet).toHaveBeenCalledWith('/dashboard/ews?tahun=2026')
        expect(result.current.data).toHaveLength(1)
    })
})

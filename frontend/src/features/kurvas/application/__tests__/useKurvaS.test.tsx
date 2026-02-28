import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useKurvaS } from '@/features/kurvas/application/useKurvaS'
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

describe('useKurvaS', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(apiGet).mockResolvedValue({
            paket: { ID: 'p-1', NamaPaket: 'Paket 1', Kasatker: 'Satker A' },
            targets: [
                { Bulan: 1, PersenKeuangan: 10, PersenFisik: 5 },
                { Bulan: 2, PersenKeuangan: 20, PersenFisik: 15 },
            ],
            realisasi: [{ Bulan: 1, PersenAktual: 7, CatatanKendala: 'K1' }],
        })
    })

    it('does not call API when id is undefined', async () => {
        const { wrapper } = createWrapper()
        const { result } = renderHook(() => useKurvaS(undefined), { wrapper })

        expect(apiGet).not.toHaveBeenCalled()

        await expect(result.current.refetch()).resolves.toMatchObject({
            status: 'error',
        })
    })

    it('builds cumulative chart data and nulls a future month without data', async () => {
        const { wrapper } = createWrapper()

        const { result } = renderHook(() => useKurvaS('p-1'), { wrapper })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(apiGet).toHaveBeenCalledWith('/paket/p-1')

        const firstMonth = result.current.data?.chartData[0]
        const currentMonth = new Date().getMonth() + 1
        const futureMonthIndex = Math.min(currentMonth + 1, 12) - 1
        const futureMonth = result.current.data?.chartData[futureMonthIndex]

        expect(firstMonth?.rencanaKeu).toBe(10)
        expect(firstMonth?.rencanaFisik).toBe(5)
        expect(firstMonth?.realisasiFisik).toBe(7)
        expect(firstMonth?.kendala).toBe('K1')

        expect(futureMonth?.realisasiFisik).toBeNull()
    })

    it('supports fallback response shape without nested fields', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce({
            ID: 'p-2',
            NamaPaket: 'Paket Fallback',
            Kasatker: 'Satker B',
        } as never)

        const { wrapper } = createWrapper()
        const { result } = renderHook(() => useKurvaS('p-2'), { wrapper })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data?.paket.ID).toBe('p-2')
        expect(result.current.data?.chartData[0].kendala).toBe('')
        expect(result.current.data?.chartData[0].rencanaKeu).toBe(0)
    })

    it('handles row with zero progress and empty kendala as hasData=false path', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce({
            paket: { ID: 'p-3', NamaPaket: 'Paket 3', Kasatker: 'Satker C' },
            targets: [{ Bulan: 1, PersenKeuangan: 1, PersenFisik: 1 }],
            realisasi: [{ Bulan: 1, PersenAktual: 0, CatatanKendala: '' }],
        })

        const { wrapper } = createWrapper()
        const { result } = renderHook(() => useKurvaS('p-3'), { wrapper })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.chartData[0].realisasiFisik).toBe(0)
        expect(result.current.data?.chartData[0].kendala).toBe('')
    })
})

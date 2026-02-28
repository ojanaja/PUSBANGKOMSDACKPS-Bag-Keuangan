import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useDashboardData } from '@/features/dashboard/application/useDashboardData'
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

describe('useDashboardData', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(apiGet).mockImplementation(async (path: string) => {
            if (path.startsWith('/paket?tahun=')) {
                return [
                    {
                        ID: 'p1',
                        NamaPaket: 'Paket 1',
                        PaguPaket: '1000',
                        PaguAnggaran: '1000',
                        RealisasiAnggaran: '500',
                        RealisasiFisik: '0',
                    },
                    {
                        ID: 'p2',
                        NamaPaket: 'Paket 2',
                        PaguPaket: '1000',
                        PaguAnggaran: '1000',
                        RealisasiAnggaran: '500',
                        RealisasiFisik: '40',
                    },
                    {
                        ID: 'p3',
                        NamaPaket: 'Paket 3',
                        PaguPaket: '1000',
                        PaguAnggaran: '1000',
                        RealisasiAnggaran: '500',
                        RealisasiFisik: '60',
                    },
                ]
            }

            if (path.startsWith('/dashboard/chart?tahun=')) {
                return [
                    {
                        bulan: '1',
                        rencana_keuangan: '10',
                        realisasi_keuangan: '8',
                        rencana_fisik: '9',
                        realisasi_fisik: '7',
                    },
                ]
            }

            if (path === '/dashboard/drilldown?bulan=2') {
                return [
                    {
                        paket_id: 'p1',
                        nama_paket: 'Paket 1',
                        pagu_paket: '1000',
                        realisasi_keuangan: '200',
                        realisasi_fisik: '20',
                        dokumen: [{ id: 'd1', kategori: 'FISIK', jenis_dokumen: 'FOTO', original_name: 'a.jpg', file_size_bytes: '1234' }],
                    },
                ]
            }

            return []
        })
    })

    it('maps paket/chart data and calculates status + critical count', async () => {
        const { wrapper } = createWrapper()

        const { result } = renderHook(() => useDashboardData(), { wrapper })

        await waitFor(() => expect(result.current.paketQuery.isSuccess).toBe(true))
        await waitFor(() => expect(result.current.chartQuery.isSuccess).toBe(true))

        expect(result.current.rowData).toHaveLength(3)
        expect(result.current.rowData[0].status).toBe('TIDAK_LENGKAP')
        expect(result.current.rowData[1].status).toBe('PERINGATAN')
        expect(result.current.rowData[2].status).toBe('LENGKAP')
        expect(result.current.criticalCount).toBe(1)

        expect(result.current.chartQuery.data?.[0].bulan).toBe(1)
        expect(result.current.chartQuery.data?.[0].label).toBeTruthy()
    })

    it('loads drilldown only after month is selected', async () => {
        const { wrapper } = createWrapper()

        const { result } = renderHook(() => useDashboardData(), { wrapper })

        await waitFor(() => expect(result.current.paketQuery.isSuccess).toBe(true))

        expect(apiGet).not.toHaveBeenCalledWith('/dashboard/drilldown?bulan=2')

        act(() => {
            result.current.setSelectedMonth(2)
        })

        await waitFor(() => expect(result.current.drilldownQuery.isSuccess).toBe(true))

        expect(apiGet).toHaveBeenCalledWith('/dashboard/drilldown?bulan=2')
        expect(result.current.drilldownQuery.data?.[0].dokumen[0].file_size_bytes).toBe(1234)
    })

    it('handles fallback conversions for zero/invalid values and empty drilldown docs', async () => {
        vi.mocked(apiGet).mockImplementation(async (path: string) => {
            if (path.startsWith('/paket?tahun=')) {
                return [
                    {
                        ID: 'p4',
                        NamaPaket: 'Paket Fallback',
                        PaguPaket: 'oops',
                        PaguAnggaran: 0,
                        RealisasiAnggaran: 'not-number',
                        RealisasiFisik: '40.6',
                    },
                ]
            }

            if (path.startsWith('/dashboard/chart?tahun=')) {
                return [
                    {
                        bulan: '13',
                        rencana_keuangan: 'x',
                        realisasi_keuangan: '0',
                        rencana_fisik: '7.5',
                        realisasi_fisik: 'abc',
                    },
                ]
            }

            if (path === '/dashboard/drilldown?bulan=3') {
                return [
                    {
                        paket_id: 'p4',
                        nama_paket: 'Paket Fallback',
                        pagu_paket: 'bad',
                        realisasi_keuangan: '11',
                        realisasi_fisik: '3',
                    },
                ]
            }

            return []
        })

        const { wrapper } = createWrapper()
        const { result } = renderHook(() => useDashboardData(), { wrapper })

        await waitFor(() => expect(result.current.paketQuery.isSuccess).toBe(true))
        await waitFor(() => expect(result.current.chartQuery.isSuccess).toBe(true))

        expect(result.current.rowData[0].realisasiKeuangan).toBe(0)
        expect(result.current.rowData[0].status).toBe('LENGKAP')
        expect(result.current.rowData[0].realisasiFisik).toBe(41)
        expect(result.current.chartQuery.data?.[0].label).toBe('13')

        act(() => {
            result.current.setSelectedMonth(3)
            result.current.setTahun(2027)
        })

        await waitFor(() => expect(result.current.drilldownQuery.isSuccess).toBe(true))
        expect(result.current.tahun).toBe(2027)
        expect(result.current.drilldownQuery.data?.[0].pagu_paket).toBe(0)
        expect(result.current.drilldownQuery.data?.[0].dokumen).toEqual([])
    })

    it('returns empty mapped arrays when paket/chart/drilldown API payload is null', async () => {
        vi.mocked(apiGet).mockImplementation(async (path: string) => {
            if (path.startsWith('/paket?tahun=')) return null as never
            if (path.startsWith('/dashboard/chart?tahun=')) return null as never
            if (path.startsWith('/dashboard/drilldown?bulan=')) return null as never
            return []
        })

        const { wrapper } = createWrapper()
        const { result } = renderHook(() => useDashboardData(), { wrapper })

        await waitFor(() => expect(result.current.paketQuery.isSuccess).toBe(true))
        await waitFor(() => expect(result.current.chartQuery.isSuccess).toBe(true))

        expect(result.current.rowData).toEqual([])
        expect(result.current.chartQuery.data).toEqual([])

        act(() => {
            result.current.setSelectedMonth(4)
        })

        await waitFor(() => expect(result.current.drilldownQuery.isSuccess).toBe(true))
        expect(result.current.drilldownQuery.data).toEqual([])
    })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useAuditLogs } from '@/features/audit/application/useAuditLogs'
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

describe('useAuditLogs', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(apiGet).mockResolvedValue({ logs: [], total: 0 })
    })

    it('uses default limit and computes offset', async () => {
        const { wrapper } = createWrapper()

        const { result } = renderHook(() => useAuditLogs(2), { wrapper })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(apiGet).toHaveBeenCalledWith('/audit-logs?limit=20&offset=40')
    })

    it('uses custom limit and page for offset', async () => {
        const { wrapper } = createWrapper()

        renderHook(() => useAuditLogs(3, 10), { wrapper })

        await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/audit-logs?limit=10&offset=30'))
    })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useNotifications } from '@/features/notifications/application/useNotifications'
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

describe('useNotifications', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(apiGet).mockResolvedValue([])
    })

    it('fetches notifications and exposes notifications list', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce([
            { id: 'n1', title: 'A', detail: 'B', time: 'Now', type: 'warning' },
        ])
        const { wrapper } = createWrapper()

        const { result } = renderHook(() => useNotifications(), { wrapper })

        await waitFor(() => expect(result.current.query.isSuccess).toBe(true))

        expect(apiGet).toHaveBeenCalledWith('/dashboard/notifications')
        expect(result.current.notifications).toHaveLength(1)
    })

    it('returns empty array when API response is not an array', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce({} as never)
        const { wrapper } = createWrapper()

        const { result } = renderHook(() => useNotifications(), { wrapper })

        await waitFor(() => expect(result.current.query.isSuccess).toBe(true))

        expect(result.current.notifications).toEqual([])
    })

    it('does not run query when disabled', async () => {
        const { wrapper } = createWrapper()
        renderHook(() => useNotifications(false), { wrapper })

        await waitFor(() => {
            expect(apiGet).not.toHaveBeenCalled()
        })
    })
})

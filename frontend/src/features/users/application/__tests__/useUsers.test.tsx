import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useUsers } from '@/features/users/application/useUsers'
import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/api/httpClient'

vi.mock('@/shared/api/httpClient', () => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
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

    const wrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    return { queryClient, wrapper }
}

describe('useUsers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(apiGet).mockResolvedValue([])
    })

    it('fetches users list via /users endpoint', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce([
            {
                ID: '1',
                Username: 'admin',
                FullName: 'Super Admin',
                Role: 'SUPER_ADMIN',
                CreatedAt: '2026-01-01T00:00:00Z',
            },
        ])
        const { wrapper } = createWrapperAndClient()

        const { result } = renderHook(() => useUsers(), { wrapper })

        await waitFor(() => expect(result.current.query.isSuccess).toBe(true))

        expect(apiGet).toHaveBeenCalledWith('/users')
        expect(result.current.query.data).toHaveLength(1)
    })

    it('creates a new user when id is not provided and invalidates users query', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce([])
        vi.mocked(apiPost).mockResolvedValueOnce({ ok: true })
        const { queryClient, wrapper } = createWrapperAndClient()
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useUsers(), { wrapper })

        await act(async () => {
            await result.current.saveMutation.mutateAsync({
                data: {
                    username: 'new-user',
                    full_name: 'New User',
                    password: 'secret123',
                    role: 'PPK',
                },
            })
        })

        expect(apiPost).toHaveBeenCalledWith('/users', {
            username: 'new-user',
            full_name: 'New User',
            password: 'secret123',
            role: 'PPK',
        })
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['users'] })
    })

    it('updates user when id is provided', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce([])
        vi.mocked(apiPut).mockResolvedValueOnce({ ok: true })
        const { queryClient, wrapper } = createWrapperAndClient()
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useUsers(), { wrapper })

        await act(async () => {
            await result.current.saveMutation.mutateAsync({
                id: '42',
                data: {
                    username: 'updated-user',
                    full_name: 'Updated User',
                    password: 'updated-secret',
                    role: 'ADMIN_KEUANGAN',
                },
            })
        })

        expect(apiPut).toHaveBeenCalledWith('/users/42', {
            username: 'updated-user',
            full_name: 'Updated User',
            password: 'updated-secret',
            role: 'ADMIN_KEUANGAN',
        })
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['users'] })
    })

    it('deletes user and invalidates users query', async () => {
        vi.mocked(apiGet).mockResolvedValueOnce([])
        vi.mocked(apiDelete).mockResolvedValueOnce({ ok: true })
        const { queryClient, wrapper } = createWrapperAndClient()
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useUsers(), { wrapper })

        await act(async () => {
            await result.current.deleteMutation.mutateAsync('99')
        })

        expect(apiDelete).toHaveBeenCalledWith('/users/99')
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['users'] })
    })
})

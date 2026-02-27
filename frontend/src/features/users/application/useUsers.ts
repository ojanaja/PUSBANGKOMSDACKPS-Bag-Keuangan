import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/api/httpClient'
import type { UserRole } from '@/stores/authStore'

export interface UserItem {
    ID: string
    Username: string
    FullName: string
    Role: UserRole
    CreatedAt: string
}

export interface UserFormData {
    username: string
    full_name: string
    password: string
    role: UserRole
}

export function useUsers() {
    const queryClient = useQueryClient()

    const query = useQuery<UserItem[]>({
        queryKey: ['users'],
        queryFn: () => apiGet<UserItem[]>('/users')
    })

    const saveMutation = useMutation({
        mutationFn: ({ id, data }: { id?: string, data: UserFormData }) => {
            return id ? apiPut(`/users/${id}`, data) : apiPost('/users', data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiDelete(`/users/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
        }
    })

    return {
        query,
        saveMutation,
        deleteMutation
    }
}

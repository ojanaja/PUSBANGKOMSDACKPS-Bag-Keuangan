import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/shared/api/httpClient'

export interface EwsNotification {
    id: string
    title: string
    detail: string
    time: string
    type: 'critical' | 'warning' | 'info'
    paket_id?: string
}

export function useNotifications(enabled = true) {
    const query = useQuery<EwsNotification[]>({
        queryKey: ['notifications'],
        queryFn: async () => {
            const result = await apiGet<EwsNotification[]>('/dashboard/notifications')
            return Array.isArray(result) ? result : []
        },
        enabled,
    })

    return {
        notifications: query.data ?? [],
        isLoading: query.isLoading,
        refetch: query.refetch,
        query,
    }
}

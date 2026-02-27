import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/shared/api/httpClient'

export interface AuditLog {
    id: string
    user_id: string
    user_full_name: string
    user_username: string
    action: string
    target_type: string
    target_id: string
    details: Record<string, unknown> | null
    ip_address: string
    user_agent: string
    created_at: string
}

export function useAuditLogs(page: number, limit: number = 20) {
    return useQuery<{ logs: AuditLog[], total: number }>({
        queryKey: ['audit-logs', page, limit],
        queryFn: () => {
            const offset = page * limit
            return apiGet<{ logs: AuditLog[], total: number }>(`/audit-logs?limit=${limit}&offset=${offset}`)
        }
    })
}

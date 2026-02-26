import { apiGet } from '@/shared/api/httpClient'
import type { EwsNotification } from '@/features/notifications/domain/entities'
import type { NotificationRepository } from '@/features/notifications/domain/repository'

export class HttpNotificationRepository implements NotificationRepository {
    async getLatest(): Promise<EwsNotification[]> {
        const result = await apiGet<EwsNotification[]>('/api/v1/dashboard/notifications')
        return Array.isArray(result) ? result : []
    }
}

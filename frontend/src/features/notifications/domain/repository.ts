import type { EwsNotification } from './entities'

export interface NotificationRepository {
    getLatest(): Promise<EwsNotification[]>
}

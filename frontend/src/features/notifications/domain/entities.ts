export type NotificationSeverity = 'critical' | 'warning' | 'info'

export interface EwsNotification {
    id: string
    title: string
    detail: string
    time: string
    type: NotificationSeverity
    paket_id?: string
}

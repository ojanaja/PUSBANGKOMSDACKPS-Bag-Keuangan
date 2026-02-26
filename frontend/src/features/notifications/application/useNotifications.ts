import { useCallback, useMemo, useState } from 'react'
import { HttpNotificationRepository } from '@/features/notifications/data/httpNotificationRepository'
import type { EwsNotification } from '@/features/notifications/domain/entities'

export function useNotifications() {
    const repository = useMemo(() => new HttpNotificationRepository(), [])
    const [notifications, setNotifications] = useState<EwsNotification[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const fetchNotifications = useCallback(async () => {
        setIsLoading(true)
        try {
            const latest = await repository.getLatest()
            setNotifications(latest)
        } catch {
            setNotifications([])
        } finally {
            setIsLoading(false)
        }
    }, [repository])

    return {
        notifications,
        isLoading,
        fetchNotifications,
    }
}

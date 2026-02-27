/**
 * Centralised month-name constants — single source of truth for the whole app.
 * Use MONTHS_SHORT for compact displays (charts, table headers).
 * Use MONTHS_LONG for full-word displays (drawer titles, table rows).
 */
export const MONTHS_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
] as const

export const MONTHS_LONG = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const

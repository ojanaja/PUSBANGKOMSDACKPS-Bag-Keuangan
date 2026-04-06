/**
 * Fiscal year options used across all year-select dropdowns.
 * Update this single source when expanding the supported range.
 */
export const FISCAL_YEAR_OPTIONS = [2024, 2025, 2026, 2027] as const

export type FiscalYear = (typeof FISCAL_YEAR_OPTIONS)[number]

export const MONTH_OPTIONS = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' }
] as const

export type MonthValue = (typeof MONTH_OPTIONS)[number]['value']

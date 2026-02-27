/**
 * Fiscal year options used across all year-select dropdowns.
 * Update this single source when expanding the supported range.
 */
export const FISCAL_YEAR_OPTIONS = [2024, 2025, 2026, 2027] as const

export type FiscalYear = (typeof FISCAL_YEAR_OPTIONS)[number]

import { describe, it, expect } from 'vitest'
import { formatCurrency } from '@/lib/formatCurrency'

describe('formatCurrency', () => {
    it('formats a positive integer', () => {
        const result = formatCurrency(1500000)
        expect(result).toContain('Rp')
        expect(result).toContain('1.500.000')
    })

    it('formats zero', () => {
        const result = formatCurrency(0)
        expect(result).toContain('Rp')
        expect(result).toContain('0')
    })

    it('formats a negative value', () => {
        const result = formatCurrency(-250000)
        expect(result).toContain('250.000')
    })

    it('formats large numbers with dot separators', () => {
        const result = formatCurrency(12345678900)
        expect(result).toContain('12.345.678.900')
    })

    it('truncates decimals (minimumFractionDigits: 0)', () => {
        const result = formatCurrency(1234.56)
        expect(result).not.toContain(',56')
    })
})

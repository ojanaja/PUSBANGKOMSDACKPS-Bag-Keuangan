import { describe, it, expect } from 'vitest'
import { buildTree, type APIAnggaranNode } from '@/features/anggaran/application/useAnggaran'

function makeNode(overrides: Partial<APIAnggaranNode> = {}): APIAnggaranNode {
    return {
        id: '1',
        parent_id: null,
        jenis: 'program',
        kode: '01',
        uraian: 'Program A',
        tahun_anggaran: 2024,
        pagu_revisi: '1000000',
        lock_pagu: '0',
        realisasi_periode_lalu: '0',
        realisasi_periode_ini: '500000',
        realisasi_sd_periode: '500000',
        persentase_realisasi: '50',
        sisa_anggaran: '500000',
        level: 1,
        path: ['1'],
        ...overrides,
    }
}

describe('buildTree', () => {
    it('returns empty array for empty input', () => {
        expect(buildTree([])).toEqual([])
    })

    it('builds a tree from flat nodes matching id and parent_id', () => {
        const rows = [
            makeNode({ id: 'P1', parent_id: null }),
            makeNode({ id: 'K1', parent_id: 'P1' }),
            makeNode({ id: 'O1', parent_id: 'K1' }),
        ]
        
        const tree = buildTree(rows)
        expect(tree).toHaveLength(1)
        expect(tree[0].id).toBe('P1')
        expect(tree[0].children).toHaveLength(1)
        expect(tree[0].children![0].id).toBe('K1')
        expect(tree[0].children![0].children).toHaveLength(1)
        expect(tree[0].children![0].children![0].id).toBe('O1')
    })

    it('parses string values to numbers', () => {
        const rows = [
            makeNode({
                pagu_revisi: '123.45',
                lock_pagu: '10.5',
                realisasi_periode_lalu: '20',
                realisasi_periode_ini: '30',
                realisasi_sd_periode: '50',
                persentase_realisasi: '40.5',
                sisa_anggaran: '73.45',
            })
        ]
        
        const tree = buildTree(rows)
        expect(tree[0].pagu_revisi).toBe(123.45)
        expect(tree[0].lock_pagu).toBe(10.5)
        expect(tree[0].realisasi_periode_lalu).toBe(20)
        expect(tree[0].realisasi_periode_ini).toBe(30)
        expect(tree[0].realisasi_sd_periode).toBe(50)
        expect(tree[0].persentase_realisasi).toBe(40.5)
        expect(tree[0].sisa_anggaran).toBe(73.45)
    })

    it('handles various empty/null representations of parent_id as roots', () => {
        const rows = [
            makeNode({ id: '1', parent_id: null }),
            makeNode({ id: '2', parent_id: '' }),
            makeNode({ id: '3', parent_id: '00000000-0000-0000-0000-000000000000' }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            makeNode({ id: '4', parent_id: { String: '', Valid: false } as any }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            makeNode({ id: '5', parent_id: { String: '00000000-0000-0000-0000-000000000000', Valid: true } as any }),
        ]
        
        const tree = buildTree(rows)
        expect(tree).toHaveLength(5)
    })

    it('handles parent_id as object with Valid=true', () => {
        const rows = [
            makeNode({ id: 'P1', parent_id: null }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            makeNode({ id: 'K1', parent_id: { String: 'P1', Valid: true } as any }),
        ]
        
        const tree = buildTree(rows)
        expect(tree).toHaveLength(1)
        expect(tree[0].id).toBe('P1')
        expect(tree[0].children).toHaveLength(1)
        expect(tree[0].children![0].id).toBe('K1')
    })
    
    it('defaults invalid parsed numbers to 0', () => {
        const rows = [
            makeNode({
                pagu_revisi: 'invalid',
                sisa_anggaran: '',
            })
        ]
        
        const tree = buildTree(rows)
        expect(tree[0].pagu_revisi).toBe(0)
        expect(tree[0].sisa_anggaran).toBe(0)
    })
    
    it('handles missing parent silently by treating as root', () => {
        const rows = [
            makeNode({ id: 'C1', parent_id: 'NON_EXISTENT' }),
        ]
        
        const tree = buildTree(rows)
        expect(tree).toHaveLength(1)
        expect(tree[0].id).toBe('C1')
    })
})

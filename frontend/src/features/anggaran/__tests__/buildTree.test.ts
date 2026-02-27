import { describe, it, expect } from 'vitest'
import { buildTree } from '@/features/anggaran/application/useAnggaran'
import type { AnggaranTreeRow } from '@/features/anggaran/application/useAnggaran'

function makeRow(overrides: Partial<AnggaranTreeRow> = {}): AnggaranTreeRow {
    return {
        ProgramID: 'P1', ProgramKode: '01', ProgramUraian: 'Program A',
        KegiatanID: 'K1', KegiatanKode: '01.01', KegiatanUraian: 'Kegiatan A',
        OutputID: 'O1', OutputKode: '01.01.01', OutputUraian: 'Output A',
        SubOutputID: 'S1', SubOutputKode: '01.01.01.01', SubOutputUraian: 'SubOutput A',
        AkunID: 'A1', AkunKode: '521111', AkunUraian: 'Belanja A',
        Pagu: 1000000, Realisasi: 500000, Sisa: 500000,
        ...overrides,
    }
}

describe('buildTree', () => {
    it('returns empty array for empty input', () => {
        expect(buildTree([])).toEqual([])
    })

    it('builds a single-row tree with all levels', () => {
        const tree = buildTree([makeRow()])
        expect(tree).toHaveLength(1)
        const program = tree[0]
        expect(program.id).toBe('P1')
        expect(program.pagu).toBe(1000000)
        expect(program.children).toHaveLength(1)

        const kegiatan = program.children![0]
        expect(kegiatan.id).toBe('K1')
        expect(kegiatan.children).toHaveLength(1)

        const output = kegiatan.children![0]
        expect(output.id).toBe('O1')
        expect(output.children).toHaveLength(1)

        const subOutput = output.children![0]
        expect(subOutput.id).toBe('S1')
        expect(subOutput.children).toHaveLength(1)

        const akun = subOutput.children![0]
        expect(akun.id).toBe('A1')
        expect(akun.pagu).toBe(1000000)
    })

    it('aggregates pagu values from multiple akun under the same hierarchy', () => {
        const rows = [
            makeRow({ AkunID: 'A1', Pagu: 100, Realisasi: 50, Sisa: 50 }),
            makeRow({ AkunID: 'A2', AkunKode: '521112', AkunUraian: 'Belanja B', Pagu: 200, Realisasi: 100, Sisa: 100 }),
        ]
        const tree = buildTree(rows)
        const program = tree[0]
        expect(program.pagu).toBe(300)
        expect(program.realisasi).toBe(150)
        expect(program.sisa).toBe(150)

        const subOutput = program.children![0].children![0].children![0]
        expect(subOutput.children).toHaveLength(2)
        expect(subOutput.pagu).toBe(300)
    })

    it('groups multiple kegiatan under the same program', () => {
        const rows = [
            makeRow({ KegiatanID: 'K1', Pagu: 100, Realisasi: 0, Sisa: 100 }),
            makeRow({ KegiatanID: 'K2', KegiatanKode: '01.02', KegiatanUraian: 'Kegiatan B', Pagu: 200, Realisasi: 0, Sisa: 200 }),
        ]
        const tree = buildTree(rows)
        expect(tree).toHaveLength(1)
        expect(tree[0].children).toHaveLength(2)
        expect(tree[0].pagu).toBe(300)
    })

    it('handles snake_case fields from API', () => {
        const row = {
            program_id: 'P1', program_kode: '01', program_uraian: 'Program A',
            kegiatan_id: 'K1', kegiatan_kode: '01.01', kegiatan_uraian: 'Kegiatan A',
            output_id: 'O1', output_kode: '01.01.01', output_uraian: 'Output A',
            sub_output_id: 'S1', sub_output_kode: '01.01.01.01', sub_output_uraian: 'SubOutput A',
            akun_id: 'A1', akun_kode: '521111', akun_uraian: 'Belanja A',
            pagu: 500000, realisasi: 250000, sisa: 250000,
        } as unknown as AnggaranTreeRow
        const tree = buildTree([row])
        expect(tree).toHaveLength(1)
        expect(tree[0].id).toBe('P1')
        expect(tree[0].pagu).toBe(500000)
    })

    it('skips rows with no ProgramID', () => {
        const row = makeRow({ ProgramID: '', program_id: undefined })
        const tree = buildTree([row])
        expect(tree).toHaveLength(0)
    })

    it('deduplicates same akun by aggregating values', () => {
        const rows = [
            makeRow({ Pagu: 100, Realisasi: 50, Sisa: 50 }),
            makeRow({ Pagu: 200, Realisasi: 100, Sisa: 100 }),
        ]
        const tree = buildTree(rows)
        const akun = tree[0].children![0].children![0].children![0].children![0]
        expect(akun.pagu).toBe(300)
        expect(akun.realisasi).toBe(150)
    })
})

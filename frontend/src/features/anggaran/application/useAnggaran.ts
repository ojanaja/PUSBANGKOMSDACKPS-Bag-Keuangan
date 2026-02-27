import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/shared/api/httpClient'

export interface AnggaranTreeRow {
    ProgramID: string
    ProgramKode: string
    ProgramUraian: string
    KegiatanID: string
    KegiatanKode: string
    KegiatanUraian: string
    OutputID: string
    OutputKode: string
    OutputUraian: string
    SubOutputID: string
    SubOutputKode: string
    SubOutputUraian: string
    AkunID: string
    AkunKode: string
    AkunUraian: string
    Pagu: number
    Realisasi: number
    Sisa: number
    program_id?: string
    program_kode?: string
    program_uraian?: string
    kegiatan_id?: string
    kegiatan_kode?: string
    kegiatan_uraian?: string
    output_id?: string
    output_kode?: string
    output_uraian?: string
    sub_output_id?: string
    sub_output_kode?: string
    sub_output_uraian?: string
    akun_id?: string
    akun_kode?: string
    akun_uraian?: string
    pagu?: number
    realisasi?: number
    sisa?: number
}

export interface TreeNode {
    id: string
    kode: string
    uraian: string
    pagu: number
    realisasi: number
    sisa: number
    children?: TreeNode[]
}

export function buildTree(rows: AnggaranTreeRow[]): TreeNode[] {
    const programMap = new Map<string, TreeNode>()

    for (const row of rows) {
        const ProgramID = row.ProgramID || row.program_id;
        const ProgramKode = row.ProgramKode || row.program_kode;
        const ProgramUraian = row.ProgramUraian || row.program_uraian;
        const KegiatanID = row.KegiatanID || row.kegiatan_id;
        const KegiatanKode = row.KegiatanKode || row.kegiatan_kode;
        const KegiatanUraian = row.KegiatanUraian || row.kegiatan_uraian;
        const OutputID = row.OutputID || row.output_id;
        const OutputKode = row.OutputKode || row.output_kode;
        const OutputUraian = row.OutputUraian || row.output_uraian;
        const SubOutputID = row.SubOutputID || row.sub_output_id;
        const SubOutputKode = row.SubOutputKode || row.sub_output_kode;
        const SubOutputUraian = row.SubOutputUraian || row.sub_output_uraian;
        const AkunID = row.AkunID || row.akun_id;
        const AkunKode = row.AkunKode || row.akun_kode;
        const AkunUraian = row.AkunUraian || row.akun_uraian;

        const rawPagu = row.Pagu ?? row.pagu
        const pagu = typeof rawPagu === 'number' ? rawPagu : (parseFloat(String(rawPagu)) || 0)
        const rawRealisasi = row.Realisasi ?? row.realisasi
        const realisasi = typeof rawRealisasi === 'number' ? rawRealisasi : (parseFloat(String(rawRealisasi)) || 0)
        const rawSisa = row.Sisa ?? row.sisa
        const sisa = typeof rawSisa === 'number' ? rawSisa : (parseFloat(String(rawSisa)) || 0)

        if (!ProgramID) continue;

        if (!programMap.has(ProgramID)) {
            programMap.set(ProgramID, {
                id: ProgramID,
                kode: ProgramKode,
                uraian: ProgramUraian,
                pagu: 0, realisasi: 0, sisa: 0,
                children: [],
            })
        }
        const program = programMap.get(ProgramID)!

        let kegiatan = program.children!.find(k => k.id === KegiatanID)
        if (!kegiatan && KegiatanID) {
            kegiatan = {
                id: KegiatanID,
                kode: KegiatanKode,
                uraian: KegiatanUraian,
                pagu: 0, realisasi: 0, sisa: 0,
                children: [],
            }
            program.children!.push(kegiatan)
        }
        if (!kegiatan) continue;

        let output = kegiatan.children!.find(o => o.id === OutputID)
        if (!output && OutputID) {
            output = {
                id: OutputID,
                kode: OutputKode,
                uraian: OutputUraian,
                pagu: 0, realisasi: 0, sisa: 0,
                children: [],
            }
            kegiatan.children!.push(output)
        }
        if (!output) continue;

        let subOutput = output.children!.find(s => s.id === SubOutputID)
        if (!subOutput && SubOutputID) {
            subOutput = {
                id: SubOutputID,
                kode: SubOutputKode,
                uraian: SubOutputUraian,
                pagu: 0, realisasi: 0, sisa: 0,
                children: [],
            }
            output.children!.push(subOutput)
        }
        if (!subOutput) continue;

        const existingAkun = subOutput.children!.find(a => a.id === AkunID)
        if (existingAkun) {
            existingAkun.pagu += pagu
            existingAkun.realisasi += realisasi
            existingAkun.sisa += sisa
        } else if (AkunID) {
            subOutput.children!.push({
                id: AkunID,
                kode: AkunKode,
                uraian: AkunUraian,
                pagu, realisasi, sisa,
            })
        }

        subOutput.pagu += pagu
        subOutput.realisasi += realisasi
        subOutput.sisa += sisa

        output.pagu += pagu
        output.realisasi += realisasi
        output.sisa += sisa

        kegiatan.pagu += pagu
        kegiatan.realisasi += realisasi
        kegiatan.sisa += sisa

        program.pagu += pagu
        program.realisasi += realisasi
        program.sisa += sisa
    }

    return Array.from(programMap.values())
}

export function useAnggaran(tahun: number) {
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: ['anggaran', tahun],
        queryFn: async () => {
            const data = await apiGet<AnggaranTreeRow[]>(`/anggaran/tree?tahun=${tahun}`)
            return buildTree(data || [])
        }
    })

    const importMutation = useMutation({
        mutationFn: async ({ file, tahun }: { file: File, tahun: number }) => {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('tahun', tahun.toString())

            return apiPost('/anggaran/import', formData)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['anggaran'] })
        }
    })

    const manualMutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            return apiPost('/anggaran/manual', data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['anggaran'] })
        }
    })

    return {
        query,
        importMutation,
        manualMutation
    }
}

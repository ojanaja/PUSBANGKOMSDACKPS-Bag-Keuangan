import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/shared/api/httpClient'

export interface APIAnggaranNode {
    id: string
    parent_id: string | null
    jenis: string
    kode: string
    uraian: string
    tahun_anggaran: number
    pagu_revisi: string
    lock_pagu: string
    realisasi_periode_lalu: string
    realisasi_periode_ini: string
    realisasi_sd_periode: string
    persentase_realisasi: string
    sisa_anggaran: string
    level: number
    path: string[]
}

export interface TreeNode {
    id: string
    kode: string
    uraian: string
    pagu_revisi: number
    lock_pagu: number
    realisasi_periode_lalu: number
    realisasi_periode_ini: number
    realisasi_sd_periode: number
    persentase_realisasi: number
    sisa_anggaran: number
    children?: TreeNode[]
}

export function buildTree(rows: APIAnggaranNode[]): TreeNode[] {
    const map = new Map<string, TreeNode>()
    const roots: TreeNode[] = []

    for (const row of rows) {
        const node: TreeNode = {
            id: row.id,
            kode: row.kode,
            uraian: row.uraian,
            pagu_revisi: parseFloat(row.pagu_revisi) || 0,
            lock_pagu: parseFloat(row.lock_pagu) || 0,
            realisasi_periode_lalu: parseFloat(row.realisasi_periode_lalu) || 0,
            realisasi_periode_ini: parseFloat(row.realisasi_periode_ini) || 0,
            realisasi_sd_periode: parseFloat(row.realisasi_sd_periode) || 0,
            persentase_realisasi: parseFloat(row.persentase_realisasi) || 0,
            sisa_anggaran: parseFloat(row.sisa_anggaran) || 0,
            children: []
        }

        map.set(node.id, node)

        if (!row.parent_id || row.parent_id === '00000000-0000-0000-0000-000000000000' || !(row.parent_id as any)?.Valid) {
            let isRoot = true
            if (typeof row.parent_id === 'string' && row.parent_id !== '00000000-0000-0000-0000-000000000000' && row.parent_id !== '') {
                isRoot = false
            } else if (typeof row.parent_id === 'object' && row.parent_id !== null && (row.parent_id as any).Valid) {
                isRoot = false
                row.parent_id = (row.parent_id as any).String
            }

            if (isRoot) {
                roots.push(node)
                continue
            }
        }

        let parentIdStr = typeof row.parent_id === 'string' ? row.parent_id : (row.parent_id as any)?.String
        const parent = map.get(parentIdStr)
        if (parent) {
            parent.children!.push(node)
        } else {
            roots.push(node)
        }
    }

    return roots
}

export function useAnggaran(tahun: number, bulan?: number) {
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: ['anggaran', tahun, bulan],
        queryFn: async () => {
            const params = new URLSearchParams({ tahun: tahun.toString() })
            if (bulan) params.append('bulan', bulan.toString())
            const data = await apiGet<APIAnggaranNode[]>(`/anggaran/tree?${params.toString()}`)
            return buildTree(data || [])
        }
    })

    const importMutation = useMutation({
        mutationFn: async ({ file, tahun }: { file: File, tahun: number }) => {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('tahun', tahun.toString())

            return apiPost<{ programs_upserted?: number; akun_upserted?: number }>('/anggaran/import', formData)
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

    const uploadBuktiMutation = useMutation({
        mutationFn: async ({ id, file }: { id: string, file: File }) => {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('node_id', id)
            return apiPost('/anggaran/upload-bukti', formData)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['anggaran'] })
        }
    })

    return {
        query,
        importMutation,
        manualMutation,
        uploadBuktiMutation
    }
}

export interface AnggaranDokumenItem {
	id: string
	anggaran_node_id: string
	file_hash_sha256: string
	original_name: string
	mime_type: string
	file_size_bytes: number
	created_at: string
}

export function useAnggaranDokumen(nodeId: string | null) {
	return useQuery({
		queryKey: ['anggaran', 'documents', nodeId],
		queryFn: async () => {
			if (!nodeId) return []
			const data = await apiGet<AnggaranDokumenItem[]>(`/anggaran/${nodeId}/documents`)
			return data || []
		},
		enabled: !!nodeId
	})
}

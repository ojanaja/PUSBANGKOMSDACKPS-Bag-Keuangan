import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/shared/api/httpClient'

export interface ComplianceRow {
    ID: string
    NamaPaket: string
    PaguPaket: number
    PaguAnggaran: number
    RealisasiAnggaran: number
    RealisasiFisik: number
}

export interface ChartData {
    bulan: number
    rencana_keuangan: number
    realisasi_keuangan: number
    rencana_fisik: number
    realisasi_fisik: number
    label: string
}

export interface DrilldownDoc {
    id: string
    kategori: string
    jenis_dokumen: string
    original_name: string
    file_size_bytes: number
}

export interface DrilldownPkt {
    paket_id: string
    nama_paket: string
    pagu_paket: number
    realisasi_keuangan: number
    realisasi_fisik: number
    dokumen: DrilldownDoc[]
}

export type StatusType = 'TIDAK_LENGKAP' | 'PERINGATAN' | 'LENGKAP'

import { MONTHS_SHORT } from '@/shared/config/months'
const monthNames = MONTHS_SHORT

type PaketRowApi = {
    ID: string
    NamaPaket: string
    PaguPaket: number | string
    PaguAnggaran: number | string
    RealisasiAnggaran: number | string
    RealisasiFisik: number | string
}

type ChartDataApi = {
    bulan: number | string
    rencana_keuangan: number | string
    realisasi_keuangan: number | string
    rencana_fisik: number | string
    realisasi_fisik: number | string
}

type DrilldownDocApi = {
    id: string
    kategori: string
    jenis_dokumen: string
    original_name: string
    file_size_bytes: number | string
}

type DrilldownPktApi = {
    paket_id: string
    nama_paket: string
    pagu_paket: number | string
    realisasi_keuangan: number | string
    realisasi_fisik: number | string
    dokumen?: DrilldownDocApi[]
}

function toNumber(value: number | string): number {
    return Number(value) || 0
}

function calculateStatus(row: ComplianceRow): StatusType {
    const pctKeu = row.PaguAnggaran > 0 ? (row.RealisasiAnggaran / row.PaguAnggaran) * 100 : 0
    const pctFis = row.RealisasiFisik

    if (pctKeu > 0 && pctFis === 0) return 'TIDAK_LENGKAP'
    if (pctFis < pctKeu * 0.9) return 'PERINGATAN'
    return 'LENGKAP'
}

export function useDashboardData() {
    const [tahun, setTahun] = useState(new Date().getFullYear())
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

    const paketQuery = useQuery({
        queryKey: ['pakets', tahun],
        queryFn: () => apiGet<PaketRowApi[]>(`/paket?tahun=${tahun}`),
        select: (rows): ComplianceRow[] =>
            (rows || []).map((row) => ({
                ...row,
                PaguPaket: toNumber(row.PaguPaket),
                PaguAnggaran: toNumber(row.PaguAnggaran),
                RealisasiAnggaran: toNumber(row.RealisasiAnggaran),
                RealisasiFisik: toNumber(row.RealisasiFisik),
            })),
    })

    const chartQuery = useQuery<ChartData[]>({
        queryKey: ['dashboardChart', tahun],
        queryFn: async () => {
            const rows = await apiGet<ChartDataApi[]>(`/dashboard/chart?tahun=${tahun}`)
            return (rows || []).map((item) => ({
                bulan: toNumber(item.bulan),
                rencana_keuangan: toNumber(item.rencana_keuangan),
                realisasi_keuangan: toNumber(item.realisasi_keuangan),
                rencana_fisik: toNumber(item.rencana_fisik),
                realisasi_fisik: toNumber(item.realisasi_fisik),
                label: monthNames[toNumber(item.bulan) - 1] || `${item.bulan}`,
            }))
        },
    })

    const drilldownQuery = useQuery<DrilldownPkt[]>({
        queryKey: ['dashboardDrilldown', selectedMonth],
        enabled: selectedMonth !== null,
        queryFn: async () => {
            const rows = await apiGet<DrilldownPktApi[]>(`/dashboard/drilldown?bulan=${selectedMonth}`)
            return (rows || []).map((item) => ({
                paket_id: item.paket_id,
                nama_paket: item.nama_paket,
                pagu_paket: toNumber(item.pagu_paket),
                realisasi_keuangan: toNumber(item.realisasi_keuangan),
                realisasi_fisik: toNumber(item.realisasi_fisik),
                dokumen: (item.dokumen || []).map((doc) => ({
                    id: doc.id,
                    kategori: doc.kategori,
                    jenis_dokumen: doc.jenis_dokumen,
                    original_name: doc.original_name,
                    file_size_bytes: toNumber(doc.file_size_bytes),
                })),
            }))
        },
    })

    const rowData = useMemo(() => {
        return (paketQuery.data || []).map((row) => {
            const realisasiKeuangan = row.PaguAnggaran > 0 ? Math.round((row.RealisasiAnggaran / row.PaguAnggaran) * 100) : 0
            return {
                ...row,
                status: calculateStatus(row),
                realisasiKeuangan,
                realisasiFisik: Math.round(row.RealisasiFisik),
            }
        })
    }, [paketQuery.data])

    const criticalCount = useMemo(
        () => rowData.filter((paket) => paket.status === 'TIDAK_LENGKAP').length,
        [rowData],
    )

    return {
        tahun,
        setTahun,
        selectedMonth,
        setSelectedMonth,
        monthNames,
        rowData,
        criticalCount,
        paketQuery,
        chartQuery,
        drilldownQuery,
    }
}

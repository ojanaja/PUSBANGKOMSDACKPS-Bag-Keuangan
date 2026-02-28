-- name: GetDashboardChart :many
WITH months AS (
    SELECT generate_series(1, 12) AS bulan
),
paket_filtered AS (
    SELECT DISTINCT p.id, p.pagu_paket
    FROM paket_pekerjaan p
    JOIN paket_akun_mapping pam ON p.id = pam.paket_id
    JOIN anggaran_akun aa ON pam.akun_id = aa.id
    JOIN anggaran_sub_output aso ON aa.sub_output_id = aso.id
    JOIN anggaran_output ao ON aso.output_id = ao.id
    JOIN anggaran_kegiatan ak ON ao.kegiatan_id = ak.id
    JOIN anggaran_program apr ON ak.program_id = apr.id
    WHERE (apr.tahun_anggaran = $1 OR $1 = 0)
),
paket_totals AS (
    SELECT 
        COALESCE(SUM(pagu_paket), 0::numeric) as total_pagu,
        COUNT(*) as total_count
    FROM paket_filtered
),
realisasi_fisik_agg AS (
    SELECT
        rf.bulan,
        (COALESCE(SUM(rf.persen_aktual), 0::numeric) / GREATEST(NULLIF(pt.total_count, 0), 1))::numeric as avg_realisasi_fisik
    FROM paket_realisasi_fisik rf
    JOIN paket_filtered pf ON rf.paket_id = pf.id
    CROSS JOIN paket_totals pt
    GROUP BY rf.bulan, pt.total_count
),
target_fisik_agg AS (
    SELECT
        tf.bulan,
        (COALESCE(SUM(tf.persen_fisik), 0::numeric) / GREATEST(NULLIF(pt.total_count, 0), 1))::numeric as avg_target_fisik
    FROM paket_target tf
    JOIN paket_filtered pf ON tf.paket_id = pf.id
    CROSS JOIN paket_totals pt
    GROUP BY tf.bulan, pt.total_count
),
target_keuangan_agg AS (
    SELECT
        tf.bulan,
        COALESCE(SUM(tf.persen_keuangan * p.pagu_paket / 100.0), 0::numeric)::numeric as sum_target_keuangan
    FROM paket_target tf
    JOIN paket_filtered p ON tf.paket_id = p.id
    GROUP BY tf.bulan
),
sp2d_bulanan AS (
    SELECT 
        ras.bulan as bulan,
        COALESCE(SUM(ras.nilai_cair), 0::numeric)::numeric as total_realisasi_keuangan
    FROM realisasi_anggaran_sp2d ras
    JOIN anggaran_akun aa ON ras.akun_id = aa.id
    JOIN anggaran_sub_output aso ON aa.sub_output_id = aso.id
    JOIN anggaran_output ao ON aso.output_id = ao.id
    JOIN anggaran_kegiatan ak ON ao.kegiatan_id = ak.id
    JOIN anggaran_program apr ON ak.program_id = apr.id
    WHERE (apr.tahun_anggaran = $1 OR $1 = 0)
    GROUP BY ras.bulan
),
sp2d_kumulatif AS (
    SELECT 
        m.bulan,
        (SUM(COALESCE(s.total_realisasi_keuangan, 0::numeric)) OVER (ORDER BY m.bulan))::numeric as kumulatif_realisasi_keuangan
    FROM months m
    LEFT JOIN sp2d_bulanan s ON m.bulan = s.bulan
)
SELECT 
    m.bulan::int as bulan,
    COALESCE(pt.total_pagu, 0::numeric)::numeric as total_pagu_paket,
    COALESCE(tka.sum_target_keuangan, 0::numeric) as rencana_keuangan_persen,
    COALESCE(sk.kumulatif_realisasi_keuangan, 0::numeric)::numeric as realisasi_keuangan_rp,
    COALESCE(tfa.avg_target_fisik, 0::numeric) as rencana_fisik_persen,
    COALESCE(rfa.avg_realisasi_fisik, 0::numeric) as realisasi_fisik_persen
FROM months m
CROSS JOIN paket_totals pt
LEFT JOIN target_keuangan_agg tka ON m.bulan = tka.bulan
LEFT JOIN target_fisik_agg tfa ON m.bulan = tfa.bulan
LEFT JOIN realisasi_fisik_agg rfa ON m.bulan = rfa.bulan
LEFT JOIN sp2d_kumulatif sk ON m.bulan = sk.bulan
ORDER BY m.bulan;

-- name: GetDashboardDrillDown :many
WITH paket_filtered AS (
    SELECT DISTINCT p.id, p.nama_paket, p.pagu_paket
    FROM paket_pekerjaan p
    JOIN paket_akun_mapping pam ON p.id = pam.paket_id
    JOIN anggaran_akun aa ON pam.akun_id = aa.id
    JOIN anggaran_sub_output aso ON aa.sub_output_id = aso.id
    JOIN anggaran_output ao ON aso.output_id = ao.id
    JOIN anggaran_kegiatan ak ON ao.kegiatan_id = ak.id
    JOIN anggaran_program apr ON ak.program_id = apr.id
    WHERE (apr.tahun_anggaran = $2 OR $2 = 0)
),
pkt_realisasi_rp AS (
    SELECT
        pf.id as paket_id,
        COALESCE(SUM(s.nilai_cair), 0::numeric)::numeric as realisasi_keuangan_rp
    FROM paket_filtered pf
    LEFT JOIN paket_akun_mapping pam ON pf.id = pam.paket_id
    LEFT JOIN realisasi_anggaran_sp2d s ON pam.akun_id = s.akun_id AND s.bulan <= $1
    GROUP BY pf.id
),
pkt_doc_agg AS (
    SELECT
        d.paket_id,
        json_agg(
            json_build_object(
                'id', d.id,
                'kategori', d.kategori,
                'jenis_dokumen', d.jenis_dokumen,
                'original_name', d.original_name,
                'file_size_bytes', d.file_size_bytes
            )
        ) FILTER (WHERE d.id IS NOT NULL) as dokumen_list
    FROM dokumen_bukti d
    JOIN paket_filtered pf ON d.paket_id = pf.id
    WHERE d.bulan = $1
    GROUP BY d.paket_id
)
SELECT 
    pf.id as paket_id,
    pf.nama_paket,
    pf.pagu_paket,
    COALESCE(pr.realisasi_keuangan_rp, 0::numeric) as realisasi_keuangan_rp,
    COALESCE(rf.persen_aktual, 0::numeric) as realisasi_fisik_persen,
    COALESCE(pd.dokumen_list, '[]'::json) as dokumen
FROM paket_filtered pf
LEFT JOIN pkt_realisasi_rp pr ON pf.id = pr.paket_id
LEFT JOIN paket_realisasi_fisik rf ON pf.id = rf.paket_id AND rf.bulan = $1
LEFT JOIN pkt_doc_agg pd ON pf.id = pd.paket_id
ORDER BY pf.nama_paket;

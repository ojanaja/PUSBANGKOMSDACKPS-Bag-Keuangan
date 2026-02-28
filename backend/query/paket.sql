-- name: InsertPaketPekerjaan :one
INSERT INTO paket_pekerjaan (id, nama_paket, kasatker, lokasi, pagu_paket, status, ppk_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetPaketPekerjaanByID :one
SELECT * FROM paket_pekerjaan WHERE id = $1;

-- name: ListPaketPekerjaan :many
SELECT * FROM paket_pekerjaan ORDER BY created_at DESC;

-- name: InsertPaketAkunMapping :exec
INSERT INTO paket_akun_mapping (paket_id, akun_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: InsertPaketTarget :one
INSERT INTO paket_target (id, paket_id, bulan, persen_keuangan, persen_fisik)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (paket_id, bulan) DO UPDATE SET persen_keuangan = EXCLUDED.persen_keuangan, persen_fisik = EXCLUDED.persen_fisik
RETURNING *;

-- name: GetPaketTargetsByPaketID :many
SELECT * FROM paket_target WHERE paket_id = $1 ORDER BY bulan;

-- name: UpsertRealisasiFisik :one
INSERT INTO paket_realisasi_fisik (id, paket_id, bulan, persen_aktual, catatan_kendala, updated_by)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (paket_id, bulan) DO UPDATE SET persen_aktual = EXCLUDED.persen_aktual, catatan_kendala = EXCLUDED.catatan_kendala, updated_by = EXCLUDED.updated_by
RETURNING *;

-- name: GetRealisasiFisikByPaketID :many
SELECT rf.*, u.full_name as verified_by_full_name
FROM paket_realisasi_fisik rf
LEFT JOIN users u ON u.id = rf.verified_by
WHERE rf.paket_id = $1 ORDER BY rf.bulan;

-- name: GetComplianceMatrix :many
SELECT 
    p.id, 
    p.nama_paket, 
    p.pagu_paket, 
    COALESCE(SUM(aa.pagu), 0)::numeric as pagu_anggaran,
    COALESCE(SUM(aa.realisasi), 0)::numeric as realisasi_anggaran,
    COALESCE(MAX(rf.persen_aktual), 0)::numeric as realisasi_fisik
FROM paket_pekerjaan p
LEFT JOIN paket_akun_mapping pam ON pam.paket_id = p.id
LEFT JOIN anggaran_akun aa ON aa.id = pam.akun_id
LEFT JOIN anggaran_sub_output aso ON aa.sub_output_id = aso.id
LEFT JOIN anggaran_output ao ON aso.output_id = ao.id
LEFT JOIN anggaran_kegiatan ak ON ao.kegiatan_id = ak.id
LEFT JOIN anggaran_program apr ON ak.program_id = apr.id
LEFT JOIN paket_realisasi_fisik rf ON rf.paket_id = p.id
WHERE (apr.tahun_anggaran = $1 OR $1 = 0 OR apr.tahun_anggaran IS NULL)
GROUP BY p.id;

-- name: GetComplianceMatrixPaged :many
SELECT
    p.id,
    p.nama_paket,
    p.pagu_paket,
    COALESCE(ang.pagu_anggaran, 0)::numeric as pagu_anggaran,
    COALESCE(ang.realisasi_anggaran, 0)::numeric as realisasi_anggaran,
    COALESCE(rf.realisasi_fisik, 0)::numeric as realisasi_fisik
FROM paket_pekerjaan p
LEFT JOIN LATERAL (
    SELECT
        COALESCE(SUM(aa.pagu), 0)::numeric as pagu_anggaran,
        COALESCE(SUM(aa.realisasi), 0)::numeric as realisasi_anggaran
    FROM paket_akun_mapping pam
    LEFT JOIN anggaran_akun aa ON aa.id = pam.akun_id
    LEFT JOIN anggaran_sub_output aso ON aa.sub_output_id = aso.id
    LEFT JOIN anggaran_output ao ON aso.output_id = ao.id
    LEFT JOIN anggaran_kegiatan ak ON ao.kegiatan_id = ak.id
    LEFT JOIN anggaran_program apr ON ak.program_id = apr.id
    WHERE pam.paket_id = p.id
      AND (apr.tahun_anggaran = $1 OR $1 = 0 OR apr.tahun_anggaran IS NULL)
) ang ON true
LEFT JOIN LATERAL (
    SELECT COALESCE(MAX(rf.persen_aktual), 0)::numeric as realisasi_fisik
    FROM paket_realisasi_fisik rf
    WHERE rf.paket_id = p.id
) rf ON true
WHERE (
    $1 = 0
    OR NOT EXISTS (
        SELECT 1 FROM paket_akun_mapping pam0
        WHERE pam0.paket_id = p.id
    )
    OR EXISTS (
        SELECT 1
        FROM paket_akun_mapping pam1
        LEFT JOIN anggaran_akun aa1 ON aa1.id = pam1.akun_id
        LEFT JOIN anggaran_sub_output aso1 ON aa1.sub_output_id = aso1.id
        LEFT JOIN anggaran_output ao1 ON aso1.output_id = ao1.id
        LEFT JOIN anggaran_kegiatan ak1 ON ao1.kegiatan_id = ak1.id
        LEFT JOIN anggaran_program apr1 ON ak1.program_id = apr1.id
        WHERE pam1.paket_id = p.id
          AND (apr1.tahun_anggaran = $1 OR apr1.tahun_anggaran IS NULL)
    )
)
ORDER BY p.created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdatePaketPekerjaan :exec
UPDATE paket_pekerjaan
SET
    nama_paket = COALESCE(sqlc.narg('nama_paket'), nama_paket),
    kasatker = COALESCE(sqlc.narg('kasatker'), kasatker),
    lokasi = COALESCE(sqlc.narg('lokasi'), lokasi),
    pagu_paket = COALESCE(sqlc.narg('pagu_paket'), pagu_paket),
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id');

-- name: GetPaketTargetsByPaketIDs :many
SELECT id, paket_id, bulan, persen_keuangan, persen_fisik
FROM paket_target
WHERE paket_id = ANY($1::uuid[])
ORDER BY paket_id, bulan;

-- name: GetRealisasiFisikByPaketIDs :many
SELECT rf.id, rf.paket_id, rf.bulan, rf.persen_aktual, rf.catatan_kendala, rf.updated_by, rf.created_at, rf.verification_status, rf.verified_by, rf.verified_at, rf.rejection_reason, u.full_name as verified_by_full_name
FROM paket_realisasi_fisik rf
LEFT JOIN users u ON u.id = rf.verified_by
WHERE rf.paket_id = ANY($1::uuid[])
ORDER BY rf.paket_id, rf.bulan;

-- name: DeletePaketAkunMappingByPaket :exec
DELETE FROM paket_akun_mapping
WHERE paket_id = $1;

-- name: DeletePaketPekerjaan :exec
DELETE FROM paket_pekerjaan
WHERE id = $1;

-- name: VerifyRealisasiFisik :one
UPDATE paket_realisasi_fisik
SET 
    verification_status = $1,
    verified_by = $2,
    verified_at = CURRENT_TIMESTAMP,
    rejection_reason = $3
WHERE id = $4
RETURNING *;

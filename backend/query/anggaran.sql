-- name: UpsertAnggaranNode :one
INSERT INTO anggaran_node (
    id, parent_id, jenis, kode, uraian, tahun_anggaran,
    pagu_revisi, lock_pagu, realisasi_periode_lalu, realisasi_periode_ini, 
    realisasi_sd_periode, persentase_realisasi, sisa_anggaran, source
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
)
ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), kode, source) DO UPDATE SET
    uraian = EXCLUDED.uraian,
    pagu_revisi = EXCLUDED.pagu_revisi,
    lock_pagu = EXCLUDED.lock_pagu,
    realisasi_periode_lalu = EXCLUDED.realisasi_periode_lalu,
    realisasi_periode_ini = EXCLUDED.realisasi_periode_ini,
    realisasi_sd_periode = EXCLUDED.realisasi_sd_periode,
    persentase_realisasi = EXCLUDED.persentase_realisasi,
    sisa_anggaran = EXCLUDED.sisa_anggaran
RETURNING *;

-- name: UpdateLockPagu :one
UPDATE anggaran_node
SET lock_pagu = $1
WHERE id = $2
RETURNING *;

-- name: DeleteAnggaranSnapshot :exec
DELETE FROM anggaran_history WHERE snapshot_periode = $1;

-- name: CreateAnggaranSnapshot :exec
INSERT INTO anggaran_history (
    id, anggaran_node_id, parent_id, jenis, kode, uraian, tahun_anggaran,
    pagu_revisi, lock_pagu, realisasi_periode_lalu, realisasi_periode_ini,
    realisasi_sd_periode, persentase_realisasi, sisa_anggaran, source, snapshot_periode
)
SELECT 
    gen_random_uuid(), id, parent_id, jenis, kode, uraian, tahun_anggaran,
    pagu_revisi, lock_pagu, realisasi_periode_lalu, realisasi_periode_ini,
    realisasi_sd_periode, persentase_realisasi, sisa_anggaran, source, $1
FROM anggaran_node;

-- name: GetAnggaranTree :many
WITH RECURSIVE tree AS (
    SELECT 
        id, parent_id, jenis, kode, uraian, tahun_anggaran,
        pagu_revisi, lock_pagu, realisasi_periode_lalu, realisasi_periode_ini,
        realisasi_sd_periode, persentase_realisasi, sisa_anggaran, source,
        1 AS level,
        ARRAY[kode]::text[] AS path
    FROM anggaran_node a
    WHERE a.parent_id IS NULL AND a.tahun_anggaran = $1 AND a.source = ANY(string_to_array($2::text, ','))

    UNION ALL

    SELECT 
        n.id, n.parent_id, n.jenis, n.kode, n.uraian, n.tahun_anggaran,
        n.pagu_revisi, n.lock_pagu, n.realisasi_periode_lalu, n.realisasi_periode_ini,
        n.realisasi_sd_periode, n.persentase_realisasi, n.sisa_anggaran, n.source,
        t.level + 1,
        t.path || n.kode
    FROM anggaran_node n
    JOIN tree t ON n.parent_id = t.id
    WHERE n.source = ANY(string_to_array($2::text, ','))
)
SELECT * FROM tree
ORDER BY path;

-- name: InsertRealisasiSP2D :one
INSERT INTO realisasi_anggaran_sp2d (id, akun_id, bulan, nomor_sp2d, tanggal_sp2d, nilai_cair, keterangan)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetRealisasiByAkunAndBulan :many
SELECT * FROM realisasi_anggaran_sp2d
WHERE akun_id = $1 AND bulan = $2
ORDER BY tanggal_sp2d;

-- name: InsertAnggaranDokumen :one
INSERT INTO anggaran_dokumen_bukti (id, anggaran_node_id, file_hash_sha256, original_name, mime_type, file_size_bytes, uploaded_by)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetAnggaranDokumenByNode :many
SELECT 
    d.id, d.anggaran_node_id, d.file_hash_sha256, d.original_name, 
    d.mime_type, d.file_size_bytes, d.uploaded_by, d.created_at, 
    COALESCE(NULLIF(u.full_name, ''), u.username, 'User Non-Aktif') as uploaded_by_name 
FROM anggaran_dokumen_bukti d
LEFT JOIN users u ON d.uploaded_by = u.id
WHERE d.anggaran_node_id = $1
ORDER BY d.created_at DESC;

-- name: GetAnggaranDokumenByID :one
SELECT * FROM anggaran_dokumen_bukti
WHERE id = $1;

-- name: GetAvailableSnapshots :many
SELECT DISTINCT snapshot_periode
FROM anggaran_history
WHERE tahun_anggaran = $1
ORDER BY snapshot_periode;

-- name: GetAnggaranHistoryTree :many
WITH RECURSIVE tree AS (
    SELECT
        anggaran_node_id AS id, parent_id, jenis, kode, uraian, tahun_anggaran,
        pagu_revisi, lock_pagu, realisasi_periode_lalu, realisasi_periode_ini,
        realisasi_sd_periode, persentase_realisasi, sisa_anggaran, source,
        1 AS level,
        ARRAY[kode]::text[] AS path
    FROM anggaran_history a
    WHERE a.parent_id IS NULL AND a.tahun_anggaran = $1 AND a.snapshot_periode = $2 AND a.source = ANY(string_to_array($3::text, ','))

    UNION ALL

    SELECT
        n.anggaran_node_id, n.parent_id, n.jenis, n.kode, n.uraian, n.tahun_anggaran,
        n.pagu_revisi, n.lock_pagu, n.realisasi_periode_lalu, n.realisasi_periode_ini,
        n.realisasi_sd_periode, n.persentase_realisasi, n.sisa_anggaran, n.source,
        t.level + 1,
        t.path || n.kode
    FROM anggaran_history n
    JOIN tree t ON n.parent_id = t.id
    WHERE n.snapshot_periode = $2 AND n.source = ANY(string_to_array($3::text, ','))
)
SELECT * FROM tree
ORDER BY path;

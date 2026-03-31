-- name: UpsertAnggaranNode :one
INSERT INTO anggaran_node (
    id, parent_id, jenis, kode, uraian, tahun_anggaran, 
    pagu_revisi, lock_pagu, realisasi_periode_lalu, realisasi_periode_ini, 
    realisasi_sd_periode, persentase_realisasi, sisa_anggaran
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
)
ON CONFLICT (id) DO UPDATE SET
    uraian = EXCLUDED.uraian,
    pagu_revisi = EXCLUDED.pagu_revisi,
    lock_pagu = EXCLUDED.lock_pagu,
    realisasi_periode_lalu = EXCLUDED.realisasi_periode_lalu,
    realisasi_periode_ini = EXCLUDED.realisasi_periode_ini,
    realisasi_sd_periode = EXCLUDED.realisasi_sd_periode,
    persentase_realisasi = EXCLUDED.persentase_realisasi,
    sisa_anggaran = EXCLUDED.sisa_anggaran
RETURNING *;

-- name: GetAnggaranTree :many
WITH RECURSIVE tree AS (
    SELECT 
        id, parent_id, jenis, kode, uraian, tahun_anggaran,
        pagu_revisi, lock_pagu, realisasi_periode_lalu, realisasi_periode_ini,
        realisasi_sd_periode, persentase_realisasi, sisa_anggaran,
        1 AS level,
        ARRAY[kode]::text[] AS path
    FROM anggaran_node a
    WHERE a.parent_id IS NULL AND a.tahun_anggaran = $1

    UNION ALL

    SELECT 
        n.id, n.parent_id, n.jenis, n.kode, n.uraian, n.tahun_anggaran,
        n.pagu_revisi, n.lock_pagu, n.realisasi_periode_lalu, n.realisasi_periode_ini,
        n.realisasi_sd_periode, n.persentase_realisasi, n.sisa_anggaran,
        t.level + 1,
        t.path || n.kode
    FROM anggaran_node n
    JOIN tree t ON n.parent_id = t.id
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
SELECT * FROM anggaran_dokumen_bukti
WHERE anggaran_node_id = $1
ORDER BY created_at DESC;

-- name: GetAnggaranDokumenByID :one
SELECT * FROM anggaran_dokumen_bukti
WHERE id = $1;

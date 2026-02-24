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
SELECT * FROM paket_realisasi_fisik WHERE paket_id = $1 ORDER BY bulan;

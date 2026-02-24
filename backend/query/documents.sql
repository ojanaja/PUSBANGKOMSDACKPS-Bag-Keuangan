-- name: InsertDocument :one
INSERT INTO dokumen_bukti (id, paket_id, bulan, kategori, jenis_dokumen, file_hash_sha256, original_name, mime_type, file_size_bytes, uploaded_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: GetDocumentByHash :one
SELECT * FROM dokumen_bukti WHERE file_hash_sha256 = $1;

-- name: GetDocumentsByPaket :many
SELECT * FROM dokumen_bukti
WHERE paket_id = $1
ORDER BY bulan, kategori, created_at DESC;

-- name: GetDocumentsByPaketAndBulan :many
SELECT * FROM dokumen_bukti
WHERE paket_id = $1 AND bulan = $2
ORDER BY kategori, created_at DESC;

-- name: DeleteDocument :exec
DELETE FROM dokumen_bukti WHERE id = $1;

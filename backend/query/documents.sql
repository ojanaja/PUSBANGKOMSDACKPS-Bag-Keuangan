-- name: InsertDocument :one
INSERT INTO dokumen_bukti (id, paket_id, bulan, kategori, jenis_dokumen, file_hash_sha256, original_name, mime_type, file_size_bytes, uploaded_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: GetDocumentByID :one
SELECT * FROM dokumen_bukti WHERE id = $1;

-- name: GetDocumentByHash :one
SELECT * FROM dokumen_bukti WHERE file_hash_sha256 = $1;

-- name: GetDocumentsByPaket :many
SELECT d.*, u.full_name as verified_by_full_name
FROM dokumen_bukti d
LEFT JOIN users u ON u.id = d.verified_by
WHERE d.paket_id = $1
ORDER BY d.bulan, d.kategori, d.created_at DESC;

-- name: GetDocumentsByPaketIDs :many
SELECT d.*, u.full_name as verified_by_full_name
FROM dokumen_bukti d
LEFT JOIN users u ON u.id = d.verified_by
WHERE d.paket_id = ANY($1::uuid[])
ORDER BY d.paket_id, d.bulan, d.kategori, d.created_at DESC;

-- name: GetDocumentsByPaketAndBulan :many
SELECT d.*, u.full_name as verified_by_full_name
FROM dokumen_bukti d
LEFT JOIN users u ON u.id = d.verified_by
WHERE d.paket_id = $1 AND d.bulan = $2
ORDER BY d.kategori, d.created_at DESC;

-- name: DeleteDocument :exec
DELETE FROM dokumen_bukti WHERE id = $1;

-- name: VerifyDocument :one
UPDATE dokumen_bukti
SET 
    verification_status = $1,
    verified_by = $2,
    verified_at = CURRENT_TIMESTAMP,
    rejection_reason = $3
WHERE id = $4
RETURNING *;

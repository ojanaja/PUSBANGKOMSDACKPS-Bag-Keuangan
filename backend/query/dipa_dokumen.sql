-- name: InsertDipaDokumen :one
INSERT INTO dipa_dokumen (id, tahun_anggaran, bulan, revisi, file_hash_sha256, original_name, mime_type, file_size_bytes, uploaded_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetDipaDokumenByID :one
SELECT * FROM dipa_dokumen WHERE id = $1;

-- name: GetDipaDocuments :many
SELECT d.*, u.full_name as uploaded_by_name
FROM dipa_dokumen d
LEFT JOIN users u ON u.id = d.uploaded_by
WHERE d.tahun_anggaran = $1
  AND ($2::int = 0 OR d.bulan = $2)
  AND ($3::int = -1 OR d.revisi = $3)
ORDER BY d.bulan DESC, d.revisi DESC, d.created_at DESC;

-- name: DeleteDipaDokumen :exec
DELETE FROM dipa_dokumen WHERE id = $1;

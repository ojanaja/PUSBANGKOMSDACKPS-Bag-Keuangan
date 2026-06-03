ALTER TABLE anggaran_dokumen_bukti
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY anggaran_node_id
            ORDER BY created_at ASC, original_name ASC, id ASC
        ) - 1 AS next_sort_order
    FROM anggaran_dokumen_bukti
    WHERE deleted_at IS NULL
)
UPDATE anggaran_dokumen_bukti d
SET sort_order = ordered.next_sort_order
FROM ordered
WHERE d.id = ordered.id;

CREATE INDEX IF NOT EXISTS idx_anggaran_dokumen_sort_order
ON anggaran_dokumen_bukti(anggaran_node_id, sort_order, created_at);

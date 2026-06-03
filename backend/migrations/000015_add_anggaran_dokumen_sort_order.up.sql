ALTER TABLE anggaran_dokumen_bukti
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_anggaran_dokumen_sort_order
ON anggaran_dokumen_bukti(anggaran_node_id, sort_order, created_at);

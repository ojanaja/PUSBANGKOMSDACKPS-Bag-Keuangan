DROP INDEX IF EXISTS idx_anggaran_dokumen_sort_order;

ALTER TABLE anggaran_dokumen_bukti
DROP COLUMN IF EXISTS sort_order;

ALTER TABLE anggaran_node ADD COLUMN source VARCHAR(50) DEFAULT 'fa_detail';
ALTER TABLE anggaran_history ADD COLUMN source VARCHAR(50) DEFAULT 'fa_detail';

DROP INDEX IF EXISTS anggaran_node_parent_kode_idx;
CREATE UNIQUE INDEX anggaran_node_parent_kode_source_idx ON anggaran_node(COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), kode, source);

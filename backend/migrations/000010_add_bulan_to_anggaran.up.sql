ALTER TABLE anggaran_node 
ADD COLUMN bulan INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS anggaran_node_parent_kode_idx;
CREATE UNIQUE INDEX anggaran_node_parent_kode_bulan_idx ON anggaran_node(COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), kode, bulan);

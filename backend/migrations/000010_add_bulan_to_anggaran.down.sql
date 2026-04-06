DROP INDEX IF EXISTS anggaran_node_parent_kode_bulan_idx;
CREATE UNIQUE INDEX anggaran_node_parent_kode_idx ON anggaran_node(COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), kode);

ALTER TABLE anggaran_node 
DROP COLUMN bulan;

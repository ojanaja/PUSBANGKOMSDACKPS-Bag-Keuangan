CREATE TABLE anggaran_history (
    id UUID PRIMARY KEY,
    anggaran_node_id UUID NOT NULL,
    parent_id UUID,
    jenis VARCHAR(50) NOT NULL,
    kode VARCHAR(255) NOT NULL,
    uraian TEXT NOT NULL,
    tahun_anggaran INTEGER,
    pagu_revisi DECIMAL(19, 4) DEFAULT 0,
    lock_pagu DECIMAL(19, 4) DEFAULT 0,
    realisasi_periode_lalu DECIMAL(19, 4) DEFAULT 0,
    realisasi_periode_ini DECIMAL(19, 4) DEFAULT 0,
    realisasi_sd_periode DECIMAL(19, 4) DEFAULT 0,
    persentase_realisasi DECIMAL(5, 2) DEFAULT 0,
    sisa_anggaran DECIMAL(19, 4) DEFAULT 0,
    snapshot_periode VARCHAR(20) NOT NULL, -- format YYYY-MM or YYYY-MM-Rev
    snapshot_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX anggaran_history_node_id_idx ON anggaran_history(anggaran_node_id);
CREATE INDEX anggaran_history_periode_idx ON anggaran_history(snapshot_periode);

ALTER TABLE anggaran_node DROP COLUMN IF EXISTS bulan CASCADE;
DROP INDEX IF EXISTS anggaran_node_parent_kode_bulan_idx;
CREATE UNIQUE INDEX anggaran_node_parent_kode_idx ON anggaran_node(COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), kode);

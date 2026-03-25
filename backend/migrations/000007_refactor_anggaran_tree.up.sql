ALTER TABLE paket_akun_mapping DROP CONSTRAINT IF EXISTS paket_akun_mapping_akun_id_fkey;
ALTER TABLE realisasi_anggaran_sp2d DROP CONSTRAINT IF EXISTS realisasi_anggaran_sp2d_akun_id_fkey;

DROP TABLE IF EXISTS anggaran_akun CASCADE;
DROP TABLE IF EXISTS anggaran_sub_output CASCADE;
DROP TABLE IF EXISTS anggaran_output CASCADE;
DROP TABLE IF EXISTS anggaran_kegiatan CASCADE;
DROP TABLE IF EXISTS anggaran_program CASCADE;

CREATE TABLE anggaran_node (
    id UUID PRIMARY KEY,
    parent_id UUID REFERENCES anggaran_node(id) ON DELETE CASCADE,
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
    sisa_anggaran DECIMAL(19, 4) DEFAULT 0
);

-- B-Tree index for faster recursive tree lookup
CREATE INDEX anggaran_node_parent_id_idx ON anggaran_node(parent_id);
-- Unique index to prevent duplicate nodes under same parent
CREATE UNIQUE INDEX anggaran_node_parent_kode_idx ON anggaran_node(COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), kode);

ALTER TABLE paket_akun_mapping 
    ADD CONSTRAINT paket_akun_mapping_akun_id_fkey 
    FOREIGN KEY (akun_id) REFERENCES anggaran_node(id) ON DELETE CASCADE;

ALTER TABLE realisasi_anggaran_sp2d 
    ADD CONSTRAINT realisasi_anggaran_sp2d_akun_id_fkey 
    FOREIGN KEY (akun_id) REFERENCES anggaran_node(id) ON DELETE CASCADE;

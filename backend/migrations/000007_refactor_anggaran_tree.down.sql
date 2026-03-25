-- This is a placeholder down migration
DROP TABLE IF EXISTS anggaran_node CASCADE;

CREATE TABLE anggaran_program (
    id UUID PRIMARY KEY,
    kode VARCHAR(50) UNIQUE NOT NULL,
    uraian TEXT NOT NULL,
    tahun_anggaran INTEGER NOT NULL
);

CREATE TABLE anggaran_kegiatan (
    id UUID PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES anggaran_program(id),
    kode VARCHAR(50) UNIQUE NOT NULL,
    uraian TEXT NOT NULL
);

CREATE TABLE anggaran_output (
    id UUID PRIMARY KEY,
    kegiatan_id UUID NOT NULL REFERENCES anggaran_kegiatan(id),
    kode VARCHAR(50) UNIQUE NOT NULL,
    uraian TEXT NOT NULL
);

CREATE TABLE anggaran_sub_output (
    id UUID PRIMARY KEY,
    output_id UUID NOT NULL REFERENCES anggaran_output(id),
    kode VARCHAR(50) UNIQUE NOT NULL,
    uraian TEXT NOT NULL
);

CREATE TABLE anggaran_akun (
    id UUID PRIMARY KEY,
    sub_output_id UUID NOT NULL REFERENCES anggaran_sub_output(id),
    kode VARCHAR(50) UNIQUE NOT NULL,
    uraian TEXT NOT NULL,
    pagu DECIMAL(19, 4) NOT NULL DEFAULT 0,
    realisasi DECIMAL(19, 4) NOT NULL DEFAULT 0,
    sisa DECIMAL(19, 4) NOT NULL DEFAULT 0
);

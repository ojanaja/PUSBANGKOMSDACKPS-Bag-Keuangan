CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- SUPER_ADMIN, ADMIN_KEUANGAN, PPK, PENGAWAS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Anggaran Hierarchical Reference Tables
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

-- Paket Pekerjaan
CREATE TABLE paket_pekerjaan (
    id UUID PRIMARY KEY,
    nama_paket VARCHAR(255) NOT NULL,
    kasatker VARCHAR(255) NOT NULL,
    lokasi TEXT NOT NULL,
    pagu_paket DECIMAL(19, 4) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- DRAFT, BERJALAN, SELESAI
    ppk_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Mapping Paket ke Akun Anggaran (M2M)
CREATE TABLE paket_akun_mapping (
    paket_id UUID NOT NULL REFERENCES paket_pekerjaan(id) ON DELETE CASCADE,
    akun_id UUID NOT NULL REFERENCES anggaran_akun(id) ON DELETE CASCADE,
    PRIMARY KEY (paket_id, akun_id)
);

-- Target Rencana Bulanan (Jan-Des) per Paket
CREATE TABLE paket_target (
    id UUID PRIMARY KEY,
    paket_id UUID NOT NULL REFERENCES paket_pekerjaan(id) ON DELETE CASCADE,
    bulan INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
    persen_keuangan DECIMAL(5, 2) NOT NULL DEFAULT 0,
    persen_fisik DECIMAL(5, 2) NOT NULL DEFAULT 0,
    UNIQUE(paket_id, bulan)
);

-- Realisasi Progres Lapangan (Fisik) per Paket
CREATE TABLE paket_realisasi_fisik (
    id UUID PRIMARY KEY,
    paket_id UUID NOT NULL REFERENCES paket_pekerjaan(id) ON DELETE CASCADE,
    bulan INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
    persen_aktual DECIMAL(5, 2) NOT NULL DEFAULT 0,
    catatan_kendala TEXT,
    updated_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(paket_id, bulan)
);

-- Dokumen Bukti (CAS Metadata)
CREATE TABLE dokumen_bukti (
    id UUID PRIMARY KEY,
    paket_id UUID NOT NULL REFERENCES paket_pekerjaan(id) ON DELETE CASCADE,
    bulan INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
    kategori VARCHAR(50) NOT NULL, -- KEUANGAN, FISIK
    jenis_dokumen VARCHAR(100) NOT NULL, -- KWITANSI, BAST, FOTO_0, dll
    file_hash_sha256 VARCHAR(64) UNIQUE NOT NULL, -- The filename on the NAS
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Realisasi Keuangan per Akun (Untuk Drill-down SP2D)
CREATE TABLE realisasi_anggaran_sp2d (
    id UUID PRIMARY KEY,
    akun_id UUID NOT NULL REFERENCES anggaran_akun(id),
    bulan INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
    nomor_sp2d VARCHAR(100) NOT NULL,
    tanggal_sp2d DATE NOT NULL,
    nilai_cair DECIMAL(19, 4) NOT NULL,
    keterangan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

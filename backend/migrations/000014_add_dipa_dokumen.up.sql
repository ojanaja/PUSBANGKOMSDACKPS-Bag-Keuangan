CREATE TABLE dipa_dokumen (
    id UUID PRIMARY KEY,
    tahun_anggaran INTEGER NOT NULL,
    bulan INTEGER NOT NULL,
    revisi INTEGER NOT NULL DEFAULT 0,
    file_hash_sha256 VARCHAR(64) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dipa_dokumen_filter ON dipa_dokumen(tahun_anggaran, bulan, revisi);

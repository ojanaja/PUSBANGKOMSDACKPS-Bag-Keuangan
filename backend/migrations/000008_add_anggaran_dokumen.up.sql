CREATE TABLE anggaran_dokumen_bukti (
    id UUID PRIMARY KEY,
    anggaran_node_id UUID NOT NULL REFERENCES anggaran_node(id) ON DELETE CASCADE,
    file_hash_sha256 VARCHAR(64) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

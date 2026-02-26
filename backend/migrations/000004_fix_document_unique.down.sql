ALTER TABLE dokumen_bukti ADD CONSTRAINT dokumen_bukti_file_hash_sha256_key UNIQUE (file_hash_sha256);

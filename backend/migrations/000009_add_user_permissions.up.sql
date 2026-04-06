ALTER TABLE users ADD COLUMN permissions JSONB DEFAULT '[]'::jsonb;

-- Default migrations to retain access
UPDATE users SET permissions = '["anggaran:create", "anggaran:read", "anggaran:update", "anggaran:delete", "dokumen:create", "dokumen:read", "dokumen:update", "dokumen:delete"]'::jsonb WHERE role = 'SUPER_ADMIN';
UPDATE users SET permissions = '["anggaran:create", "anggaran:read", "anggaran:update", "anggaran:delete", "dokumen:create", "dokumen:read", "dokumen:update", "dokumen:delete"]'::jsonb WHERE role = 'ADMIN_KEUANGAN';
UPDATE users SET permissions = '["anggaran:read", "dokumen:create", "dokumen:read", "dokumen:delete"]'::jsonb WHERE role = 'PPK';
UPDATE users SET permissions = '[]'::jsonb WHERE role = 'PENGAWAS';

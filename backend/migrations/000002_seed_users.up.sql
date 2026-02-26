-- Seed default users for all 4 roles.
-- All users have the password: password123
-- Hash generated with bcrypt cost=12

INSERT INTO users (id, username, password_hash, full_name, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'superadmin', '$2a$12$AQE1PcKv6NlyRxHgDACLkOW0O1y1yLcjfY3z.FUWxfM7iw2r6WCOK', 'Super Administrator', 'SUPER_ADMIN'),
  ('a0000000-0000-0000-0000-000000000002', 'admin_keuangan', '$2a$12$AQE1PcKv6NlyRxHgDACLkOW0O1y1yLcjfY3z.FUWxfM7iw2r6WCOK', 'Admin Keuangan', 'ADMIN_KEUANGAN'),
  ('a0000000-0000-0000-0000-000000000003', 'ppk', '$2a$12$AQE1PcKv6NlyRxHgDACLkOW0O1y1yLcjfY3z.FUWxfM7iw2r6WCOK', 'Manajer Proyek PPK', 'PPK'),
  ('a0000000-0000-0000-0000-000000000004', 'pengawas', '$2a$12$AQE1PcKv6NlyRxHgDACLkOW0O1y1yLcjfY3z.FUWxfM7iw2r6WCOK', 'Pengawas BPK', 'PENGAWAS')
ON CONFLICT (username) DO NOTHING;

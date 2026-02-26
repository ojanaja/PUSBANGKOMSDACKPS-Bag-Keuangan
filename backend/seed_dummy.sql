-- Comprehensive Seed Data for all years (2024, 2025, 2026)
-- Clean up existing data first to ensure fresh state for demo
TRUNCATE dokumen_bukti, realisasi_anggaran_sp2d, paket_realisasi_fisik, paket_target, paket_akun_mapping, paket_pekerjaan, anggaran_akun, anggaran_sub_output, anggaran_output, anggaran_kegiatan, anggaran_program CASCADE;

--------------------------------------------------------------------------------
-- YEAR 2024 (Completed / Past Year)
--------------------------------------------------------------------------------
INSERT INTO anggaran_program (id, kode, uraian, tahun_anggaran) VALUES
('b0002024-0000-0000-0000-000000000001', '033.01.2024.P1', 'Program Infrastruktur 2024', 2024);

INSERT INTO anggaran_kegiatan (id, program_id, kode, uraian) VALUES
('b0002024-0000-0000-0000-000000000002', 'b0002024-0000-0000-0000-000000000001', '5001.24', 'Pembangunan Infrastruktur Digital');

INSERT INTO anggaran_output (id, kegiatan_id, kode, uraian) VALUES
('b0002024-0000-0000-0000-000000000003', 'b0002024-0000-0000-0000-000000000002', '5001.EBA.24', 'Pusat Data Nasional');

INSERT INTO anggaran_sub_output (id, output_id, kode, uraian) VALUES
('b0002024-0000-0000-0000-000000000004', 'b0002024-0000-0000-0000-000000000003', '5001.EBA.001.24', 'Server & Jaringan');

INSERT INTO anggaran_akun (id, sub_output_id, kode, uraian, pagu, realisasi, sisa) VALUES
('c0002024-0000-0000-0000-000000000001', 'b0002024-0000-0000-0000-000000000004', '532111.24', 'Belanja Modal Peralatan', 20000000000, 20000000000, 0);

INSERT INTO paket_pekerjaan (id, nama_paket, kasatker, lokasi, pagu_paket, status, ppk_id) VALUES
('d0002024-0000-0000-0000-000000000001', 'Instalasi Server Utama BPK (Past)', 'Satker BPK Pusat', 'Jakarta', 18000000000, 'SELESAI', 'a0000000-0000-0000-0000-000000000003');

INSERT INTO paket_akun_mapping (paket_id, akun_id) VALUES
('d0002024-0000-0000-0000-000000000001', 'c0002024-0000-0000-0000-000000000001');

-- Targets & Realizations for 2024 (Full year)
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 1..12 LOOP
        INSERT INTO paket_target (id, paket_id, bulan, persen_keuangan, persen_fisik) 
        VALUES (gen_random_uuid(), 'd0002024-0000-0000-0000-000000000001', i, i*8.33, i*8.33);
        
        INSERT INTO paket_realisasi_fisik (id, paket_id, bulan, persen_aktual, catatan_kendala, updated_by)
        VALUES (gen_random_uuid(), 'd0002024-0000-0000-0000-000000000001', i, i*8.33, 'Selesai tepat waktu', 'a0000000-0000-0000-0000-000000000003');

        INSERT INTO realisasi_anggaran_sp2d (id, akun_id, bulan, nomor_sp2d, tanggal_sp2d, nilai_cair)
        VALUES (gen_random_uuid(), 'c0002024-0000-0000-0000-000000000001', i, 'SP2D/'||i||'/2024', ('2024-'||i||'-20')::date, 1500000000);
    END LOOP;
END $$;

--------------------------------------------------------------------------------
-- YEAR 2025 (Last Year / Ongoing to Finish)
--------------------------------------------------------------------------------
INSERT INTO anggaran_program (id, kode, uraian, tahun_anggaran) VALUES
('b0002025-0000-0000-0000-000000000001', '033.01.2025.P2', 'Program Optimalisasi Aset 2025', 2025);

INSERT INTO anggaran_kegiatan (id, program_id, kode, uraian) VALUES
('b0002025-0000-0000-0000-000000000002', 'b0002025-0000-0000-0000-000000000001', '6002.25', 'Pemeliharaan Gedung Wilayah Timur');

INSERT INTO anggaran_output (id, kegiatan_id, kode, uraian) VALUES
('b0002025-0000-0000-0000-000000000003', 'b0002025-0000-0000-0000-000000000002', '6002.EBA.25', 'Layanan Daerah');

INSERT INTO anggaran_sub_output (id, output_id, kode, uraian) VALUES
('b0002025-0000-0000-0000-000000000004', 'b0002025-0000-0000-0000-000000000003', '6002.EBA.005.25', 'Gedung Kantor Denpasar');

INSERT INTO anggaran_akun (id, sub_output_id, kode, uraian, pagu, realisasi, sisa) VALUES
('c0002025-0000-0000-0000-000000000001', 'b0002025-0000-0000-0000-000000000004', '523111.25', 'Belanja Pemeliharaan', 15000000000, 14000000000, 1000000000);

INSERT INTO paket_pekerjaan (id, nama_paket, kasatker, lokasi, pagu_paket, status, ppk_id) VALUES
('d0002025-0000-0000-0000-000000000001', 'Renovasi Gedung BPK Denpasar (2025)', 'Satker BPK Bali', 'Denpasar', 12000000000, 'BERJALAN', 'a0000000-0000-0000-0000-000000000003');

INSERT INTO paket_akun_mapping (paket_id, akun_id) VALUES
('d0002025-0000-0000-0000-000000000001', 'c0002025-0000-0000-0000-000000000001');

-- Targets for 2025
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 1..12 LOOP
        INSERT INTO paket_target (id, paket_id, bulan, persen_keuangan, persen_fisik) 
        VALUES (gen_random_uuid(), 'd0002025-0000-0000-0000-000000000001', i, i*8, i*8);
    END LOOP;
END $$;

-- Actuals for 2025 (Up to Nov)
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 1..11 LOOP
        INSERT INTO paket_realisasi_fisik (id, paket_id, bulan, persen_aktual, catatan_kendala, updated_by)
        VALUES (gen_random_uuid(), 'd0002025-0000-0000-0000-000000000001', i, i*8.1, 'Lancar', 'a0000000-0000-0000-0000-000000000003');

        INSERT INTO realisasi_anggaran_sp2d (id, akun_id, bulan, nomor_sp2d, tanggal_sp2d, nilai_cair)
        VALUES (gen_random_uuid(), 'c0002025-0000-0000-0000-000000000001', i, 'SP2D/'||i||'/2025', ('2025-'||i||'-15')::date, 1200000000);
    END LOOP;
END $$;

--------------------------------------------------------------------------------
-- YEAR 2026 (Current Year / Q1-Q2 Progress)
--------------------------------------------------------------------------------
INSERT INTO anggaran_program (id, kode, uraian, tahun_anggaran) VALUES
('b0002026-0000-0000-0000-000000000001', '033.01.2026.WA', 'Program Infrastruktur Keuangan 2026', 2026);

INSERT INTO anggaran_kegiatan (id, program_id, kode, uraian) VALUES
('b0002026-0000-0000-0000-000000000002', 'b0002026-0000-0000-0000-000000000001', '4054.26', 'Pengelolaan Gedung & Infrastruktur');

INSERT INTO anggaran_output (id, kegiatan_id, kode, uraian) VALUES
('b0002026-0000-0000-0000-000000000003', 'b0002026-0000-0000-0000-000000000002', '4054.EBA.26', 'Layanan Perkantoran');

INSERT INTO anggaran_sub_output (id, output_id, kode, uraian) VALUES
('b0002026-0000-0000-0000-000000000004', 'b0002026-0000-0000-0000-000000000003', '4054.EBA.994.26', 'Gedung Kantor');

INSERT INTO anggaran_akun (id, sub_output_id, kode, uraian, pagu, realisasi, sisa) VALUES
('c0002026-0000-0000-0000-000000000001', 'b0002026-0000-0000-0000-000000000004', '533111.26', 'Belanja Modal Gedung', 50000000000, 15000000000, 35000000000),
('c0002026-0000-0000-0000-000000000002', 'b0002026-0000-0000-0000-000000000004', '523111.26', 'Belanja Pemeliharaan Gedung', 10000000000, 2000000000, 8000000000);

-- Paket Pekerjaan for 2026
INSERT INTO paket_pekerjaan (id, nama_paket, kasatker, lokasi, pagu_paket, status, ppk_id) VALUES
('d0002026-0000-0000-0000-000000000001', 'Pembangunan Gedung Diklat BPK (2026)', 'Satker BPK Pusat', 'Jakarta', 45000000000, 'BERJALAN', 'a0000000-0000-0000-0000-000000000003'),
('d0002026-0000-0000-0000-000000000002', 'Renovasi Aula Utama (2026)', 'Satker BPK Pusat', 'Jakarta', 8000000000, 'BERJALAN', 'a0000000-0000-0000-0000-000000000003'),
('d0002026-0000-0000-0000-000000000003', 'Pengadaan IT Equipment 2026', 'Satker BPK Pusat', 'Jakarta', 3500000000, 'DRAFT', 'a0000000-0000-0000-0000-000000000003');

INSERT INTO paket_akun_mapping (paket_id, akun_id) VALUES
('d0002026-0000-0000-0000-000000000001', 'c0002026-0000-0000-0000-000000000001'),
('d0002026-0000-0000-0000-000000000002', 'c0002026-0000-0000-0000-000000000002');

-- Targets & Realizations for 2026 (Jan - May)
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 1..12 LOOP
        -- Paket 1 Targets
        INSERT INTO paket_target (id, paket_id, bulan, persen_keuangan, persen_fisik) 
        VALUES (gen_random_uuid(), 'd0002026-0000-0000-0000-000000000001', i, i*7.5, i*8);
        -- Paket 2 Targets
        INSERT INTO paket_target (id, paket_id, bulan, persen_keuangan, persen_fisik) 
        VALUES (gen_random_uuid(), 'd0002026-0000-0000-0000-000000000002', i, i*5, i*6);
    END LOOP;
    
    FOR i IN 1..5 LOOP
        -- Paket 1 Realizations
        INSERT INTO paket_realisasi_fisik (id, paket_id, bulan, persen_aktual, catatan_kendala, updated_by)
        VALUES (gen_random_uuid(), 'd0002026-0000-0000-0000-000000000001', i, i*7.8, 'Sesuai jadwal', 'a0000000-0000-0000-0000-000000000003');

        INSERT INTO realisasi_anggaran_sp2d (id, akun_id, bulan, nomor_sp2d, tanggal_sp2d, nilai_cair)
        VALUES (gen_random_uuid(), 'c0002026-0000-0000-0000-000000000001', i, 'SP2D/'||i||'/2026', ('2026-'||i||'-10')::date, 3000000000);

        -- Paket 2 Realizations
        INSERT INTO paket_realisasi_fisik (id, paket_id, bulan, persen_aktual, catatan_kendala, updated_by)
        VALUES (gen_random_uuid(), 'd0002026-0000-0000-0000-000000000002', i, i*4.5, 'Kekurangan tenaga kerja', 'a0000000-0000-0000-0000-000000000003');

        INSERT INTO realisasi_anggaran_sp2d (id, akun_id, bulan, nomor_sp2d, tanggal_sp2d, nilai_cair)
        VALUES (gen_random_uuid(), 'c0002026-0000-0000-0000-000000000002', i, 'SP2D/B/'||i||'/2026', ('2026-'||i||'-12')::date, 400000000);
    END LOOP;
END $$;

--------------------------------------------------------------------------------
-- DOCUMENTS (DUMMY METADATA)
--------------------------------------------------------------------------------
INSERT INTO dokumen_bukti (id, paket_id, bulan, kategori, jenis_dokumen, file_hash_sha256, original_name, mime_type, file_size_bytes, uploaded_by) VALUES
(gen_random_uuid(), 'd0002026-0000-0000-0000-000000000001', 1, 'KEUANGAN', 'SP2D', 'hash26-1-k', 'SP2D_Jan_2026.pdf', 'application/pdf', 150000, 'a0000000-0000-0000-0000-000000000002'),
(gen_random_uuid(), 'd0002026-0000-0000-0000-000000000001', 1, 'FISIK', 'FOTO', 'hash26-1-f', 'Foto_Lapangan_Jan.jpg', 'image/jpeg', 250000, 'a0000000-0000-0000-0000-000000000003'),
(gen_random_uuid(), 'd0002026-0000-0000-0000-000000000001', 2, 'KEUANGAN', 'SP2D', 'hash26-2-k', 'SP2D_Feb_2026.pdf', 'application/pdf', 155000, 'a0000000-0000-0000-0000-000000000002'),
(gen_random_uuid(), 'd0002026-0000-0000-0000-000000000001', 2, 'FISIK', 'FOTO', 'hash26-2-f', 'Foto_Lapangan_Feb.jpg', 'image/jpeg', 260000, 'a0000000-0000-0000-0000-000000000003'),
(gen_random_uuid(), 'd0002026-0000-0000-0000-000000000001', 3, 'KEUANGAN', 'SP2D', 'hash26-3-k', 'SP2D_Mar_2026.pdf', 'application/pdf', 160000, 'a0000000-0000-0000-0000-000000000002'),
(gen_random_uuid(), 'd0002026-0000-0000-0000-000000000001', 3, 'FISIK', 'FOTO', 'hash26-3-f', 'Foto_Lapangan_Mar.jpg', 'image/jpeg', 270000, 'a0000000-0000-0000-0000-000000000003');

INSERT INTO dokumen_bukti (id, paket_id, bulan, kategori, jenis_dokumen, file_hash_sha256, original_name, mime_type, file_size_bytes, uploaded_by) VALUES
(gen_random_uuid(), 'd0002025-0000-0000-0000-000000000001', 1, 'KEUANGAN', 'SP2D', 'hash25-1-k', 'SP2D_Jan_2025.pdf', 'application/pdf', 140000, 'a0000000-0000-0000-0000-000000000002'),
(gen_random_uuid(), 'd0002025-0000-0000-0000-000000000001', 10, 'FISIK', 'FOTO', 'hash25-10-f', 'Foto_Lapangan_Okt_25.jpg', 'image/jpeg', 240000, 'a0000000-0000-0000-0000-000000000003');

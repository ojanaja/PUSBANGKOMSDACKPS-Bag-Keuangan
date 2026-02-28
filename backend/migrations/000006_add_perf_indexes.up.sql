-- Add indexes for better query performance on NAS / low-IO environments

CREATE INDEX IF NOT EXISTS idx_dokumen_bukti_paket_id ON dokumen_bukti(paket_id);
CREATE INDEX IF NOT EXISTS idx_dokumen_bukti_paket_id_bulan ON dokumen_bukti(paket_id, bulan);

CREATE INDEX IF NOT EXISTS idx_realisasi_anggaran_sp2d_akun_id ON realisasi_anggaran_sp2d(akun_id);
CREATE INDEX IF NOT EXISTS idx_realisasi_anggaran_sp2d_akun_id_bulan ON realisasi_anggaran_sp2d(akun_id, bulan);

CREATE INDEX IF NOT EXISTS idx_paket_pekerjaan_status ON paket_pekerjaan(status);

-- Indexes for common year filtering and FK traversal in the anggaran hierarchy.
CREATE INDEX IF NOT EXISTS idx_anggaran_program_tahun_anggaran ON anggaran_program(tahun_anggaran);
CREATE INDEX IF NOT EXISTS idx_anggaran_kegiatan_program_id ON anggaran_kegiatan(program_id);
CREATE INDEX IF NOT EXISTS idx_anggaran_output_kegiatan_id ON anggaran_output(kegiatan_id);
CREATE INDEX IF NOT EXISTS idx_anggaran_sub_output_output_id ON anggaran_sub_output(output_id);
CREATE INDEX IF NOT EXISTS idx_anggaran_akun_sub_output_id ON anggaran_akun(sub_output_id);

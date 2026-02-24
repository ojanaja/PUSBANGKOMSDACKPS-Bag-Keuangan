-- name: InsertAnggaranProgram :one
INSERT INTO anggaran_program (id, kode, uraian, tahun_anggaran)
VALUES ($1, $2, $3, $4)
ON CONFLICT (kode) DO UPDATE SET uraian = EXCLUDED.uraian, tahun_anggaran = EXCLUDED.tahun_anggaran
RETURNING *;

-- name: InsertAnggaranKegiatan :one
INSERT INTO anggaran_kegiatan (id, program_id, kode, uraian)
VALUES ($1, $2, $3, $4)
ON CONFLICT (kode) DO UPDATE SET uraian = EXCLUDED.uraian, program_id = EXCLUDED.program_id
RETURNING *;

-- name: InsertAnggaranOutput :one
INSERT INTO anggaran_output (id, kegiatan_id, kode, uraian)
VALUES ($1, $2, $3, $4)
ON CONFLICT (kode) DO UPDATE SET uraian = EXCLUDED.uraian, kegiatan_id = EXCLUDED.kegiatan_id
RETURNING *;

-- name: InsertAnggaranSubOutput :one
INSERT INTO anggaran_sub_output (id, output_id, kode, uraian)
VALUES ($1, $2, $3, $4)
ON CONFLICT (kode) DO UPDATE SET uraian = EXCLUDED.uraian, output_id = EXCLUDED.output_id
RETURNING *;

-- name: InsertAnggaranAkun :one
INSERT INTO anggaran_akun (id, sub_output_id, kode, uraian, pagu, realisasi, sisa)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (kode) DO UPDATE SET uraian = EXCLUDED.uraian, sub_output_id = EXCLUDED.sub_output_id, pagu = EXCLUDED.pagu, realisasi = EXCLUDED.realisasi, sisa = EXCLUDED.sisa
RETURNING *;

-- name: GetAnggaranTree :many
SELECT
    sp.id AS program_id, sp.kode AS program_kode, sp.uraian AS program_uraian,
    sk.id AS kegiatan_id, sk.kode AS kegiatan_kode, sk.uraian AS kegiatan_uraian,
    so.id AS output_id, so.kode AS output_kode, so.uraian AS output_uraian,
    ss.id AS sub_output_id, ss.kode AS sub_output_kode, ss.uraian AS sub_output_uraian,
    sa.id AS akun_id, sa.kode AS akun_kode, sa.uraian AS akun_uraian,
    sa.pagu, sa.realisasi, sa.sisa
FROM anggaran_program sp
JOIN anggaran_kegiatan sk ON sk.program_id = sp.id
JOIN anggaran_output so ON so.kegiatan_id = sk.id
JOIN anggaran_sub_output ss ON ss.output_id = so.id
JOIN anggaran_akun sa ON sa.sub_output_id = ss.id
WHERE sp.tahun_anggaran = $1
ORDER BY sp.kode, sk.kode, so.kode, ss.kode, sa.kode;

-- name: InsertRealisasiSP2D :one
INSERT INTO realisasi_anggaran_sp2d (id, akun_id, bulan, nomor_sp2d, tanggal_sp2d, nilai_cair, keterangan)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetRealisasiByAkunAndBulan :many
SELECT * FROM realisasi_anggaran_sp2d
WHERE akun_id = $1 AND bulan = $2
ORDER BY tanggal_sp2d;

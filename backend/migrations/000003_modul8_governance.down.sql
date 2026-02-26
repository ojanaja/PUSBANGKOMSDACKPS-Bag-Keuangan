DROP TABLE IF EXISTS activity_logs;

ALTER TABLE dokumen_bukti DROP COLUMN IF EXISTS verification_status;
ALTER TABLE dokumen_bukti DROP COLUMN IF EXISTS verified_by;
ALTER TABLE dokumen_bukti DROP COLUMN IF EXISTS verified_at;
ALTER TABLE dokumen_bukti DROP COLUMN IF EXISTS rejection_reason;

ALTER TABLE paket_realisasi_fisik DROP COLUMN IF EXISTS verification_status;
ALTER TABLE paket_realisasi_fisik DROP COLUMN IF EXISTS verified_by;
ALTER TABLE paket_realisasi_fisik DROP COLUMN IF EXISTS verified_at;
ALTER TABLE paket_realisasi_fisik DROP COLUMN IF EXISTS rejection_reason;

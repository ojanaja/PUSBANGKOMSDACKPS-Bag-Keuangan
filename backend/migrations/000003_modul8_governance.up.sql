-- Add verification status to realisasi fisik
ALTER TABLE paket_realisasi_fisik ADD COLUMN verification_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE paket_realisasi_fisik ADD COLUMN verified_by UUID REFERENCES users(id);
ALTER TABLE paket_realisasi_fisik ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE paket_realisasi_fisik ADD COLUMN rejection_reason TEXT;

-- Add verification status to dokumen bukti
ALTER TABLE dokumen_bukti ADD COLUMN verification_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE dokumen_bukti ADD COLUMN verified_by UUID REFERENCES users(id);
ALTER TABLE dokumen_bukti ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE dokumen_bukti ADD COLUMN rejection_reason TEXT;

-- Activity Logs (Audit Trail)
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    target_type VARCHAR(100),
    target_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_target ON activity_logs(target_type, target_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

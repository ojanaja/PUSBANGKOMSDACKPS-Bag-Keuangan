-- Add persistent JWT revocation support.
-- Stores SHA-256 hash of the token so stolen cookies can be invalidated immediately.

CREATE TABLE IF NOT EXISTS revoked_tokens (
  token_sha256 TEXT PRIMARY KEY,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens (expires_at);

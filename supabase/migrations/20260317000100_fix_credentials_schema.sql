-- Phase 7/8: Fix connection_credentials schema
-- Adds columns for AES-256 GCM encrypted data and initialization vectors (nonces).

ALTER TABLE public.connection_credentials 
ADD COLUMN IF NOT EXISTS encrypted_credentials TEXT,
ADD COLUMN IF NOT EXISTS iv TEXT;

-- Add UNIQUE constraint for connection_id if not present to support ON CONFLICT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'connection_credentials_connection_id_key'
    ) THEN
        ALTER TABLE public.connection_credentials ADD CONSTRAINT connection_credentials_connection_id_key UNIQUE (connection_id);
    END IF;
END $$;

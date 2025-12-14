-- Migration: Add support for staged claims workflow
-- This migration adds provider/period tracking and new status values to support
-- claims-only and remittance-only uploads

-- Add new columns to claim_recon_claims table
ALTER TABLE claim_recon_claims
  ADD COLUMN IF NOT EXISTS provider_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS period_year INTEGER,
  ADD COLUMN IF NOT EXISTS period_month INTEGER,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Make runId nullable to support standalone claims
ALTER TABLE claim_recon_claims
  ALTER COLUMN run_id DROP NOT NULL;

-- Update existing claims to populate provider/period from their run
UPDATE claim_recon_claims c
SET 
  provider_name = r.provider_name,
  period_year = r.period_year,
  period_month = r.period_month
FROM claim_recon_runs r
WHERE c.run_id = r.id AND c.provider_name IS NULL;

-- Make provider/period NOT NULL after backfilling
ALTER TABLE claim_recon_claims
  ALTER COLUMN provider_name SET NOT NULL,
  ALTER COLUMN period_year SET NOT NULL,
  ALTER COLUMN period_month SET NOT NULL;

-- Update default status from 'submitted' to 'awaiting_remittance' for new claims
ALTER TABLE claim_recon_claims
  ALTER COLUMN status SET DEFAULT 'awaiting_remittance';

-- Add new columns to claim_recon_remittances table
ALTER TABLE claim_recon_remittances
  ADD COLUMN IF NOT EXISTS provider_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS period_year INTEGER,
  ADD COLUMN IF NOT EXISTS period_month INTEGER,
  ADD COLUMN IF NOT EXISTS status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Make runId nullable to support standalone remittances
ALTER TABLE claim_recon_remittances
  ALTER COLUMN run_id DROP NOT NULL;

-- Update existing remittances to populate provider/period from their run
UPDATE claim_recon_remittances rem
SET 
  provider_name = r.provider_name,
  period_year = r.period_year,
  period_month = r.period_month
FROM claim_recon_runs r
WHERE rem.run_id = r.id AND rem.provider_name IS NULL;

-- Make provider/period NOT NULL after backfilling
ALTER TABLE claim_recon_remittances
  ALTER COLUMN provider_name SET NOT NULL,
  ALTER COLUMN period_year SET NOT NULL,
  ALTER COLUMN period_month SET NOT NULL;

-- Create indices for better performance on period queries
CREATE INDEX IF NOT EXISTS idx_claims_provider_period ON claim_recon_claims(provider_name, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_remittances_provider_period ON claim_recon_remittances(provider_name, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claim_recon_claims(status);
CREATE INDEX IF NOT EXISTS idx_remittances_status ON claim_recon_remittances(status);

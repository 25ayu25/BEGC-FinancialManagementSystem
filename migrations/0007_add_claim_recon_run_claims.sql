-- Migration: Add claim_recon_run_claims join table to track claims processed in each run
-- This fixes the "Run Details" mismatch where clicking a run shows incorrect claim counts

-- Create the join table to track which claims were processed in each run
CREATE TABLE IF NOT EXISTS claim_recon_run_claims (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES claim_recon_runs(id) ON DELETE CASCADE,
  claim_id INTEGER NOT NULL REFERENCES claim_recon_claims(id) ON DELETE CASCADE,
  status_before_run VARCHAR(50),
  status_after_run VARCHAR(50) NOT NULL,
  matched_remittance_id INTEGER REFERENCES claim_recon_remittances(id),
  match_type VARCHAR(50), -- 'exact', 'partial', 'unmatched'
  amount_paid_in_run DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(run_id, claim_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_run_claims_run_id ON claim_recon_run_claims(run_id);
CREATE INDEX IF NOT EXISTS idx_run_claims_claim_id ON claim_recon_run_claims(claim_id);

-- Add unpaid_count column to claim_recon_runs table for Issue 2
ALTER TABLE claim_recon_runs ADD COLUMN IF NOT EXISTS unpaid_count INTEGER DEFAULT 0;

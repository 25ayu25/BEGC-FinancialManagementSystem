-- Migration: Add matchMethod field for tracking how claims were matched
-- This enables the hybrid matching strategy: invoice, date+amount, or manual matching

-- Add matchMethod to claim_recon_claims table
ALTER TABLE claim_recon_claims 
ADD COLUMN IF NOT EXISTS match_method VARCHAR(32) DEFAULT NULL;

-- Add matchMethod to claim_recon_run_claims table (for historical tracking)
ALTER TABLE claim_recon_run_claims 
ADD COLUMN IF NOT EXISTS match_method VARCHAR(32) DEFAULT NULL;

-- Update existing records: if remittance_line_id is not null, assume invoice match
-- (This is the current default matching method)
UPDATE claim_recon_claims 
SET match_method = 'invoice' 
WHERE remittance_line_id IS NOT NULL 
  AND match_method IS NULL;

UPDATE claim_recon_run_claims 
SET match_method = 'invoice' 
WHERE matched_remittance_id IS NOT NULL 
  AND match_method IS NULL 
  AND match_type != 'unmatched';

-- Add index for filtering by match method
CREATE INDEX IF NOT EXISTS idx_claim_recon_claims_match_method 
ON claim_recon_claims(match_method);

-- Add comment
COMMENT ON COLUMN claim_recon_claims.match_method IS 'How the claim was matched: invoice, date_amount, manual, or null (unmatched)';
COMMENT ON COLUMN claim_recon_run_claims.match_method IS 'How the claim was matched in this run: invoice, date_amount, manual, or null (unmatched)';

-- Migration: Fix FK constraint on claim_recon_run_claims.matched_remittance_id
-- to allow deleting remittances without constraint violations
--
-- Problem: Deleting a reconciliation run fails when trying to delete remittances
-- because claim_recon_run_claims.matched_remittance_id references claim_recon_remittances.id
-- without an ON DELETE policy, causing FK constraint violations.
--
-- Solution: Drop the existing FK constraint and recreate it with ON DELETE SET NULL
-- so that when a remittance is deleted, the reference is automatically nullified.

-- Drop the existing FK constraint if it exists
ALTER TABLE claim_recon_run_claims 
  DROP CONSTRAINT IF EXISTS claim_recon_run_claims_matched_remittance_id_fkey;

-- Recreate the FK constraint with ON DELETE SET NULL
ALTER TABLE claim_recon_run_claims 
  ADD CONSTRAINT claim_recon_run_claims_matched_remittance_id_fkey
  FOREIGN KEY (matched_remittance_id) 
  REFERENCES claim_recon_remittances(id) 
  ON DELETE SET NULL;

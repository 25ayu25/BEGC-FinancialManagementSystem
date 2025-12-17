-- Migration: Fix incorrectly assigned claim statuses
-- Issue: Claims were marked as "unpaid" when they should be "awaiting_remittance"
-- Date: 2025-12-17

-- Fix 1: Claims not in any remittance should be "awaiting_remittance", not "unpaid"
-- These are claims that have never been matched to any remittance line
UPDATE claim_recon_claims
SET status = 'awaiting_remittance'
WHERE status = 'unpaid'
  AND remittance_line_id IS NULL;

-- Fix 2: Claims that ARE partially paid but marked wrong
-- These claims have a remittance match and 0 < amountPaid < billedAmount
UPDATE claim_recon_claims
SET status = 'partially_paid'
WHERE remittance_line_id IS NOT NULL
  AND CAST(amount_paid AS DECIMAL) > 0
  AND CAST(amount_paid AS DECIMAL) < CAST(billed_amount AS DECIMAL)
  AND status NOT IN ('partially_paid');

-- Fix 3: Claims fully paid but marked wrong
-- These claims have a remittance match and amountPaid >= billedAmount
UPDATE claim_recon_claims
SET status = 'matched'
WHERE remittance_line_id IS NOT NULL
  AND CAST(amount_paid AS DECIMAL) >= CAST(billed_amount AS DECIMAL)
  AND status NOT IN ('matched', 'paid');

-- Fix 4: Claims truly unpaid (in remittance with 0 paid)
-- These claims have a remittance match but amountPaid = 0
UPDATE claim_recon_claims
SET status = 'unpaid'
WHERE remittance_line_id IS NOT NULL
  AND CAST(amount_paid AS DECIMAL) = 0
  AND status NOT IN ('unpaid');

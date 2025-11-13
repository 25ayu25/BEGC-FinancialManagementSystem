-- =====================================================================
-- Insurance Overview Sample Data Seed (USD Only)
-- =====================================================================
-- This file seeds sample insurance data for testing the insurance
-- overview dashboard. All data is in USD currency.
--
-- Usage:
--   psql -d your_database -f migrations/seed-insurance-sample.sql
--
-- Rollback:
--   Delete the inserted records manually or run the cleanup section at the end
-- =====================================================================

-- Ensure we have some insurance providers
-- (Adjust IDs if your database already has providers)
INSERT INTO insurance_providers (id, code, name, is_active, created_at)
VALUES
  ('prov-001-uuid', 'NHIF', 'National Health Insurance Fund', true, NOW()),
  ('prov-002-uuid', 'BLUE', 'Blue Cross Insurance', true, NOW()),
  ('prov-003-uuid', 'AETNA', 'Aetna Health', true, NOW()),
  ('prov-004-uuid', 'CIGNA', 'Cigna International', true, NOW())
ON CONFLICT (code) DO NOTHING;

-- Get provider IDs (adjust these based on your actual provider IDs)
-- For simplicity, we'll use the codes above and assume they exist
-- In production, you'd query these first

-- Sample Insurance Claims (USD) - Last 90 days
INSERT INTO insurance_claims (
  id,
  provider_id,
  period_year,
  period_month,
  period_start,
  period_end,
  currency,
  claimed_amount,
  status,
  notes,
  created_at
)
SELECT
  gen_random_uuid() as id,
  (SELECT id FROM insurance_providers WHERE code = p.code LIMIT 1) as provider_id,
  EXTRACT(YEAR FROM d.period_start)::integer as period_year,
  EXTRACT(MONTH FROM d.period_start)::integer as period_month,
  d.period_start,
  d.period_end,
  'USD' as currency,
  d.amount as claimed_amount,
  d.status,
  d.notes,
  d.period_start as created_at
FROM (
  -- Provider: NHIF
  SELECT 'NHIF' as code, '2025-10-01'::date as period_start, '2025-10-31'::date as period_end, 25000.00 as amount, 'paid' as status, 'October claims - fully paid' as notes
  UNION ALL
  SELECT 'NHIF', '2025-09-01'::date, '2025-09-30'::date, 32000.00, 'partially_paid', 'September claims - partial payment received' as notes
  UNION ALL
  SELECT 'NHIF', '2025-08-01'::date, '2025-08-31'::date, 28500.00, 'submitted', 'August claims - pending' as notes
  
  -- Provider: Blue Cross
  UNION ALL
  SELECT 'BLUE', '2025-10-01'::date, '2025-10-31'::date, 18500.00, 'paid', 'October claims - fully paid' as notes
  UNION ALL
  SELECT 'BLUE', '2025-09-01'::date, '2025-09-30'::date, 21000.00, 'partially_paid', 'September claims - awaiting balance' as notes
  UNION ALL
  SELECT 'BLUE', '2025-08-01'::date, '2025-08-31'::date, 19500.00, 'paid', 'August claims - fully paid' as notes
  
  -- Provider: Aetna
  UNION ALL
  SELECT 'AETNA', '2025-10-01'::date, '2025-10-31'::date, 42000.00, 'submitted', 'October claims - under review' as notes
  UNION ALL
  SELECT 'AETNA', '2025-09-01'::date, '2025-09-30'::date, 38500.00, 'paid', 'September claims - fully paid' as notes
  UNION ALL
  SELECT 'AETNA', '2025-08-01'::date, '2025-08-31'::date, 40000.00, 'partially_paid', 'August claims - partial payment' as notes
  
  -- Provider: Cigna
  UNION ALL
  SELECT 'CIGNA', '2025-10-01'::date, '2025-10-31'::date, 15000.00, 'submitted', 'October claims - processing' as notes
  UNION ALL
  SELECT 'CIGNA', '2025-09-01'::date, '2025-09-30'::date, 16500.00, 'paid', 'September claims - fully paid' as notes
  UNION ALL
  SELECT 'CIGNA', '2025-08-01'::date, '2025-08-31'::date, 14200.00, 'paid', 'August claims - fully paid' as notes
) d
LEFT JOIN (SELECT code, id FROM insurance_providers) p ON p.code = d.code
WHERE p.code IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Sample Insurance Payments (USD) - Last 90 days
-- These payments correspond to the claims above
INSERT INTO insurance_payments (
  id,
  provider_id,
  claim_id,
  payment_date,
  amount,
  currency,
  reference,
  notes,
  created_at
)
SELECT
  gen_random_uuid() as id,
  (SELECT id FROM insurance_providers WHERE code = p.code LIMIT 1) as provider_id,
  (
    SELECT c.id FROM insurance_claims c
    WHERE c.provider_id = (SELECT id FROM insurance_providers WHERE code = p.code LIMIT 1)
      AND c.period_start = p.claim_period_start
    LIMIT 1
  ) as claim_id,
  p.payment_date,
  p.amount,
  'USD' as currency,
  p.reference,
  p.notes,
  p.payment_date as created_at
FROM (
  -- NHIF Payments
  SELECT 'NHIF' as code, '2025-10-01'::date as claim_period_start, '2025-10-15'::date as payment_date, 25000.00 as amount, 'PAY-NHIF-1015' as reference, 'Full payment for October' as notes
  UNION ALL
  SELECT 'NHIF', '2025-09-01'::date, '2025-09-20'::date, 20000.00, 'PAY-NHIF-0920', 'Partial payment for September (1/2)' as notes
  UNION ALL
  SELECT 'NHIF', '2025-09-01'::date, '2025-10-05'::date, 10000.00, 'PAY-NHIF-1005', 'Partial payment for September (2/2)' as notes
  
  -- Blue Cross Payments
  UNION ALL
  SELECT 'BLUE', '2025-10-01'::date, '2025-10-12'::date, 18500.00, 'PAY-BLUE-1012', 'Full payment for October' as notes
  UNION ALL
  SELECT 'BLUE', '2025-09-01'::date, '2025-09-25'::date, 15000.00, 'PAY-BLUE-0925', 'Partial payment for September' as notes
  UNION ALL
  SELECT 'BLUE', '2025-08-01'::date, '2025-08-28'::date, 19500.00, 'PAY-BLUE-0828', 'Full payment for August' as notes
  
  -- Aetna Payments
  UNION ALL
  SELECT 'AETNA', '2025-09-01'::date, '2025-09-30'::date, 38500.00, 'PAY-AETNA-0930', 'Full payment for September' as notes
  UNION ALL
  SELECT 'AETNA', '2025-08-01'::date, '2025-08-18'::date, 25000.00, 'PAY-AETNA-0818', 'Partial payment for August (1/2)' as notes
  UNION ALL
  SELECT 'AETNA', '2025-08-01'::date, '2025-09-10'::date, 10000.00, 'PAY-AETNA-0910', 'Partial payment for August (2/2)' as notes
  
  -- Cigna Payments
  UNION ALL
  SELECT 'CIGNA', '2025-09-01'::date, '2025-09-22'::date, 16500.00, 'PAY-CIGNA-0922', 'Full payment for September' as notes
  UNION ALL
  SELECT 'CIGNA', '2025-08-01'::date, '2025-08-25'::date, 14200.00, 'PAY-CIGNA-0825', 'Full payment for August' as notes
) p
ON CONFLICT (id) DO NOTHING;

-- Additional standalone payments (not linked to specific claims)
INSERT INTO insurance_payments (
  id,
  provider_id,
  claim_id,
  payment_date,
  amount,
  currency,
  reference,
  notes,
  created_at
)
SELECT
  gen_random_uuid() as id,
  (SELECT id FROM insurance_providers WHERE code = p.code LIMIT 1) as provider_id,
  NULL as claim_id,  -- Standalone payment
  p.payment_date,
  p.amount,
  'USD' as currency,
  p.reference,
  p.notes,
  p.payment_date as created_at
FROM (
  SELECT 'NHIF' as code, '2025-10-20'::date as payment_date, 5000.00 as amount, 'PAY-NHIF-ADJ-1020' as reference, 'Adjustment payment' as notes
  UNION ALL
  SELECT 'BLUE', '2025-10-18'::date, 2500.00, 'PAY-BLUE-ADJ-1018', 'Credit adjustment' as notes
) p
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- Verification Queries
-- =====================================================================
-- Run these to verify the seed data was inserted correctly:

-- Check insurance providers
-- SELECT * FROM insurance_providers WHERE code IN ('NHIF', 'BLUE', 'AETNA', 'CIGNA');

-- Check claims (should be ~12 claims)
-- SELECT COUNT(*) as claim_count, currency, status 
-- FROM insurance_claims 
-- WHERE currency = 'USD' AND period_start >= '2025-08-01'
-- GROUP BY currency, status;

-- Check payments (should be ~14 payments)
-- SELECT COUNT(*) as payment_count, currency 
-- FROM insurance_payments 
-- WHERE currency = 'USD' AND payment_date >= '2025-08-01'
-- GROUP BY currency;

-- Check balances by provider
-- SELECT 
--   ip.name,
--   ip.code,
--   COALESCE(SUM(ic.claimed_amount), 0) as total_claims,
--   COALESCE(SUM(ipm.amount), 0) as total_payments,
--   COALESCE(SUM(ic.claimed_amount), 0) - COALESCE(SUM(ipm.amount), 0) as balance
-- FROM insurance_providers ip
-- LEFT JOIN insurance_claims ic ON ic.provider_id = ip.id AND ic.currency = 'USD'
-- LEFT JOIN insurance_payments ipm ON ipm.provider_id = ip.id AND ipm.currency = 'USD'
-- WHERE ip.code IN ('NHIF', 'BLUE', 'AETNA', 'CIGNA')
-- GROUP BY ip.id, ip.name, ip.code
-- ORDER BY ip.name;

-- =====================================================================
-- Cleanup (Rollback) - CAUTION: Only run if you want to remove sample data
-- =====================================================================
-- UNCOMMENT BELOW TO REMOVE SAMPLE DATA:
--
-- -- Delete sample payments
-- DELETE FROM insurance_payments
-- WHERE reference LIKE 'PAY-NHIF-%'
--    OR reference LIKE 'PAY-BLUE-%'
--    OR reference LIKE 'PAY-AETNA-%'
--    OR reference LIKE 'PAY-CIGNA-%';
--
-- -- Delete sample claims
-- DELETE FROM insurance_claims
-- WHERE currency = 'USD'
--   AND period_start >= '2025-08-01'
--   AND provider_id IN (
--     SELECT id FROM insurance_providers 
--     WHERE code IN ('NHIF', 'BLUE', 'AETNA', 'CIGNA')
--   );
--
-- -- Optionally delete the sample providers (only if they were created by this script)
-- -- DELETE FROM insurance_providers
-- -- WHERE code IN ('NHIF', 'BLUE', 'AETNA', 'CIGNA');

-- =====================================================================
-- Notes:
-- =====================================================================
-- 1. This script uses ON CONFLICT DO NOTHING to safely handle re-runs
-- 2. Provider IDs are looked up dynamically by code
-- 3. All amounts are in USD
-- 4. Dates cover the last 3 months (Aug-Oct 2025)
-- 5. Mix of paid, partially_paid, and submitted statuses
-- 6. Some payments are linked to claims, some are standalone
-- =====================================================================

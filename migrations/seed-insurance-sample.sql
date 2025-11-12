-- Sample Insurance Data for Testing Insurance Overview Dashboard
-- This file creates sample USD insurance claims and payments across multiple providers and dates
-- Safe to run multiple times (uses INSERT ... ON CONFLICT DO NOTHING)

-- Note: This assumes insurance_providers table already has some providers
-- If not, uncomment and modify the providers section below

-- ============================================================================
-- SAMPLE PROVIDERS (uncomment if needed)
-- ============================================================================
/*
INSERT INTO insurance_providers (id, code, name, contact_person, contact_email, contact_phone, payment_terms, is_active, created_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'BCBS', 'Blue Cross Blue Shield', 'John Smith', 'john@bcbs.com', '+1-555-0101', 'Net 30', true, NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'UHC', 'United Healthcare', 'Jane Doe', 'jane@uhc.com', '+1-555-0102', 'Net 45', true, NOW()),
  ('550e8400-e29b-41d4-a716-446655440003', 'AETNA', 'Aetna Insurance', 'Bob Johnson', 'bob@aetna.com', '+1-555-0103', 'Net 30', true, NOW())
ON CONFLICT (id) DO NOTHING;
*/

-- ============================================================================
-- SAMPLE CLAIMS (USD only)
-- ============================================================================
-- Recent claims (last 90 days) with varying amounts
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
  gen_random_uuid(),
  -- Cycle through first 3 active providers
  (SELECT id FROM insurance_providers WHERE is_active = true ORDER BY created_at LIMIT 1 OFFSET (gs.n % 3)),
  date_part('year', date_series)::integer,
  date_part('month', date_series)::integer,
  date_series,
  date_series + interval '1 month' - interval '1 day',
  'USD',
  -- Varying amounts between $5,000 and $50,000
  5000 + (random() * 45000)::numeric(10,2),
  CASE 
    WHEN random() < 0.3 THEN 'submitted'
    WHEN random() < 0.7 THEN 'partially_paid'
    ELSE 'paid'
  END,
  'Sample claim for testing - Period ' || to_char(date_series, 'YYYY-MM'),
  date_series
FROM 
  generate_series(
    NOW() - interval '90 days',
    NOW(),
    interval '1 month'
  ) AS date_series,
  generate_series(0, 2) AS gs(n)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SAMPLE PAYMENTS (USD only)
-- ============================================================================
-- Create payments for claims (some full, some partial)
-- Daily payments spread across recent dates

DO $$
DECLARE
  claim_record RECORD;
  payment_date DATE;
  payment_amount NUMERIC(10,2);
  num_payments INTEGER;
  i INTEGER;
BEGIN
  -- For each sample claim created above
  FOR claim_record IN 
    SELECT 
      c.id as claim_id,
      c.provider_id,
      c.claimed_amount,
      c.period_start,
      c.status,
      c.notes
    FROM insurance_claims c
    WHERE c.currency = 'USD' 
      AND c.notes LIKE '%Sample claim for testing%'
  LOOP
    -- Skip if already has payments
    IF EXISTS (SELECT 1 FROM insurance_payments WHERE claim_id = claim_record.claim_id) THEN
      CONTINUE;
    END IF;

    -- Determine number of payments based on status
    IF claim_record.status = 'paid' THEN
      num_payments := 1 + floor(random() * 2)::integer; -- 1-2 payments
    ELSIF claim_record.status = 'partially_paid' THEN
      num_payments := 1; -- 1 partial payment
    ELSE
      num_payments := 0; -- No payments yet
    END IF;

    -- Create payments
    FOR i IN 1..num_payments LOOP
      -- Payment date is claim start + 20-60 days
      payment_date := claim_record.period_start::date + (20 + floor(random() * 40))::integer;
      
      -- Payment amount
      IF claim_record.status = 'paid' THEN
        -- Split total among payments
        payment_amount := claim_record.claimed_amount / num_payments;
      ELSE
        -- Partial payment (30-70% of claim)
        payment_amount := claim_record.claimed_amount * (0.3 + random() * 0.4);
      END IF;

      -- Insert payment
      INSERT INTO insurance_payments (
        id,
        provider_id,
        claim_id,
        payment_date,
        currency,
        amount,
        reference,
        notes,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        claim_record.provider_id,
        claim_record.claim_id,
        payment_date,
        'USD',
        payment_amount::numeric(10,2),
        'REF-' || to_char(payment_date, 'YYYYMMDD') || '-' || substr(claim_record.claim_id::text, 1, 8),
        'Sample payment ' || i || ' of ' || num_payments,
        payment_date
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- ADDITIONAL DAILY PAYMENTS (for ProviderDailyTimeline chart)
-- ============================================================================
-- Create daily payments for last 30 days to populate the daily chart
INSERT INTO insurance_payments (
  id,
  provider_id,
  claim_id,
  payment_date,
  currency,
  amount,
  reference,
  notes,
  created_at
)
SELECT 
  gen_random_uuid(),
  -- Cycle through active providers
  (SELECT id FROM insurance_providers WHERE is_active = true ORDER BY created_at LIMIT 1 OFFSET (gs.n % 3)),
  NULL, -- Not linked to specific claim
  date_series::date,
  'USD',
  -- Daily amounts between $1,000 and $10,000
  1000 + (random() * 9000)::numeric(10,2),
  'DAILY-' || to_char(date_series, 'YYYYMMDD') || '-' || gs.n,
  'Sample daily payment for testing',
  date_series
FROM 
  generate_series(
    NOW() - interval '30 days',
    NOW(),
    interval '1 day'
  ) AS date_series,
  generate_series(0, 2) AS gs(n)
WHERE 
  -- Add payments on weekdays only (more realistic)
  EXTRACT(DOW FROM date_series) BETWEEN 1 AND 5
  -- Random 70% chance to have payment on that day
  AND random() < 0.7
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Uncomment to verify data after running this script

/*
-- Check claims created
SELECT 
  COUNT(*) as total_claims,
  SUM(claimed_amount) as total_claimed,
  COUNT(DISTINCT provider_id) as unique_providers
FROM insurance_claims
WHERE notes LIKE '%Sample claim for testing%';

-- Check payments created  
SELECT 
  COUNT(*) as total_payments,
  SUM(amount) as total_paid,
  COUNT(DISTINCT provider_id) as unique_providers,
  MIN(payment_date) as earliest_payment,
  MAX(payment_date) as latest_payment
FROM insurance_payments
WHERE notes LIKE '%Sample%payment%';

-- Check daily payment distribution
SELECT 
  payment_date::date,
  COUNT(*) as payment_count,
  SUM(amount) as daily_total
FROM insurance_payments
WHERE notes LIKE '%Sample daily payment%'
GROUP BY payment_date::date
ORDER BY payment_date DESC
LIMIT 30;
*/

-- ============================================================================
-- NOTES
-- ============================================================================
-- This seed data creates:
-- 1. ~9 claims spanning last 90 days (3 providers x 3 months)
-- 2. Payments for those claims based on status
-- 3. ~60 additional daily payments for last 30 days (weekdays only)
-- 
-- All amounts in USD for insurance-overview page testing
-- Safe to run multiple times - uses ON CONFLICT DO NOTHING
-- 
-- To clean up test data:
-- DELETE FROM insurance_payments WHERE notes LIKE '%Sample%payment%';
-- DELETE FROM insurance_claims WHERE notes LIKE '%Sample claim for testing%';

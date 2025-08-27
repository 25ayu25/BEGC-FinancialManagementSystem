-- FIXED Production Database Migration Script
-- Handles duplicate AMANAH/AMAANAH issue

BEGIN;

-- Step 1: Add missing providers (safe - will not create duplicates)
INSERT INTO insurance_providers (code, name, is_active) VALUES 
  ('NILE', 'Nile International Insurance', true),
  ('ALIMA', 'ALIMA Insurance', true), 
  ('OTHER', 'Other', true)
ON CONFLICT (code) DO NOTHING;

-- Step 2: Fix existing providers to have correct names and activate them
UPDATE insurance_providers SET 
  name = 'CIC Insurance',
  is_active = true
WHERE code = 'CIC';

UPDATE insurance_providers SET 
  name = 'UAP Insurance',
  is_active = true
WHERE code = 'UAP';

UPDATE insurance_providers SET 
  name = 'CIGNA Insurance',
  is_active = true
WHERE code = 'CIGNA';

UPDATE insurance_providers SET 
  name = 'New Sudan Insurance',
  is_active = true
WHERE code IN ('NEW_SUDAN', 'NSI');

-- Step 3: Handle the AMANAH/AMAANAH duplicate issue
-- First, make sure AMANAH has the correct name and is active
UPDATE insurance_providers SET 
  name = 'Amanah Insurance',
  is_active = true
WHERE code = 'AMANAH';

-- Then disable AMAANAH (don't try to rename it, just disable it)
UPDATE insurance_providers SET 
  is_active = false
WHERE code = 'AMAANAH';

-- Step 4: Disable ALL other unwanted providers 
UPDATE insurance_providers SET is_active = false 
WHERE code NOT IN ('CIC', 'UAP', 'CIGNA', 'NILE', 'NEW_SUDAN', 'AMANAH', 'ALIMA', 'OTHER');

-- Step 5: Verify final result (should show exactly your 8 providers)
SELECT code, name, is_active FROM insurance_providers WHERE is_active = true ORDER BY name;

COMMIT;
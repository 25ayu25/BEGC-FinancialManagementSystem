-- Production Database Migration Script
-- Fix Insurance Providers to show exactly these 8 options:
-- 1. CIC Insurance, 2. UAP Insurance, 3. CIGNA Insurance, 4. New Sudan Insurance
-- 5. Amanah Insurance, 6. ALIMA Insurance, 7. Nile International Insurance, 8. Other

BEGIN;

-- Step 1: Add missing providers (safe - will not create duplicates)
INSERT INTO insurance_providers (code, name, is_active) VALUES 
  ('NILE', 'Nile International Insurance', true),
  ('ALIMA', 'ALIMA Insurance', true), 
  ('OTHER', 'Other', true)
ON CONFLICT (code) DO NOTHING;

-- Step 2: Update existing providers to have correct names
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

UPDATE insurance_providers SET 
  code = 'AMANAH',
  name = 'Amanah Insurance',
  is_active = true
WHERE code = 'AMAANAH';

-- Step 3: Disable unwanted providers (safer than deleting due to foreign key constraints)
UPDATE insurance_providers SET is_active = false 
WHERE code NOT IN ('CIC', 'UAP', 'CIGNA', 'NILE', 'NEW_SUDAN', 'AMANAH', 'ALIMA', 'OTHER');

-- Step 4: Verify final result
SELECT code, name, is_active FROM insurance_providers WHERE is_active = true ORDER BY name;

COMMIT;
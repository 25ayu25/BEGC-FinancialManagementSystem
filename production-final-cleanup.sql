-- PRODUCTION Final Cleanup: Ensure New Sudan appears in dropdown
-- Run this on your production database

-- Ensure New Sudan exists with correct name
INSERT INTO insurance_providers (code, name, is_active) VALUES 
  ('NEW_SUDAN', 'New Sudan', true)
ON CONFLICT (code) DO UPDATE SET name = 'New Sudan', is_active = true;

-- Disable old NSI entry to avoid duplicates
UPDATE insurance_providers SET is_active = false WHERE code = 'NSI';

-- Disable AMAANAH duplicate (keep AMANAH)
UPDATE insurance_providers SET is_active = false WHERE code = 'AMAANAH';

-- Final verification - should show exactly 8 providers
SELECT code, name FROM insurance_providers WHERE is_active = true ORDER BY 
  CASE 
    WHEN code = 'CIC' THEN 1
    WHEN code = 'UAP' THEN 2  
    WHEN code = 'CIGNA' THEN 3
    ELSE 10
  END, 
  name;
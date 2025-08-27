-- Apply to PRODUCTION database: Clean up provider names
UPDATE insurance_providers SET name = 'CIC' WHERE code = 'CIC';
UPDATE insurance_providers SET name = 'UAP' WHERE code = 'UAP';  
UPDATE insurance_providers SET name = 'CIGNA' WHERE code = 'CIGNA';
UPDATE insurance_providers SET name = 'New Sudan' WHERE code = 'NEW_SUDAN';
UPDATE insurance_providers SET name = 'Amanah' WHERE code = 'AMANAH';
UPDATE insurance_providers SET name = 'ALIMA' WHERE code = 'ALIMA';
UPDATE insurance_providers SET name = 'Nile International' WHERE code = 'NILE';

-- Verify clean names
SELECT code, name FROM insurance_providers WHERE is_active = true ORDER BY 
  CASE 
    WHEN code = 'CIC' THEN 1
    WHEN code = 'UAP' THEN 2  
    WHEN code = 'CIGNA' THEN 3
    ELSE 10
  END, 
  name;
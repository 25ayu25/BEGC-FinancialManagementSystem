-- Insert departments
INSERT INTO departments (id, name, description) VALUES
  ('4242abf4-e68e-48c8-9eaf-ada2612bd412', 'Consultation', 'General consultation services'),
  ('5353bcf5-f79f-59d9-afbf-beb3723ce523', 'Laboratory', 'Laboratory testing and analysis'),
  ('6464cdf6-g8ag-6ae0-bgcg-cfc4834df634', 'Ultrasound', 'Ultrasound imaging services'),
  ('7575def7-h9bh-7bf1-chch-dfd5945eg745', 'X-Ray', 'X-ray imaging services'),
  ('8686efg8-i0ci-8cg2-didi-ege6056fh856', 'Pharmacy', 'Pharmaceutical services');

-- Insert insurance providers
INSERT INTO insurance_providers (id, name, contact_info) VALUES
  ('1111aaa1-j1dj-9dh3-ejej-fgf7167gi967', 'CIC Insurance', '{"phone": "+211-912-345-678", "email": "contact@cic.ss"}'),
  ('2222bbb2-k2ek-0ei4-fkfk-ghg8278hj078', 'UAP Insurance', '{"phone": "+211-912-345-679", "email": "contact@uap.ss"}'),
  ('3333ccc3-l3fl-1fj5-glgl-hih9389ik189', 'CIGNA', '{"phone": "+211-912-345-680", "email": "contact@cigna.ss"}');

-- Insert sample transactions for August 2025
INSERT INTO transactions (id, type, amount_ssp, amount_usd, description, department_id, insurance_provider_id, patient_name, receipt_number, payment_method, created_by, created_at) VALUES
  (gen_random_uuid(), 'income', '15000.00', '11.54', 'Consultation fee', '4242abf4-e68e-48c8-9eaf-ada2612bd412', '1111aaa1-j1dj-9dh3-ejej-fgf7167gi967', 'John Doe', 'RCT001', 'insurance', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), '2025-08-15 10:30:00'),
  (gen_random_uuid(), 'income', '25000.00', '19.23', 'Laboratory tests', '5353bcf5-f79f-59d9-afbf-beb3723ce523', '2222bbb2-k2ek-0ei4-fkfk-ghg8278hj078', 'Jane Smith', 'RCT002', 'insurance', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), '2025-08-15 14:15:00'),
  (gen_random_uuid(), 'income', '35000.00', '26.92', 'Ultrasound scan', '6464cdf6-g8ag-6ae0-bgcg-cfc4834df634', NULL, 'Ahmed Hassan', 'RCT003', 'cash', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), '2025-08-16 09:00:00'),
  (gen_random_uuid(), 'income', '20000.00', '15.38', 'X-ray imaging', '7575def7-h9bh-7bf1-chch-dfd5945eg745', '3333ccc3-l3fl-1fj5-glgl-hih9389ik189', 'Sarah Wilson', 'RCT004', 'insurance', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), '2025-08-16 11:45:00'),
  (gen_random_uuid(), 'income', '12000.00', '9.23', 'Medication', '8686efg8-i0ci-8cg2-didi-ege6056fh856', NULL, 'Mohammed Ali', 'RCT005', 'cash', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), '2025-08-17 16:20:00'),
  (gen_random_uuid(), 'expense', '5000.00', '3.85', 'Medical supplies', '8686efg8-i0ci-8cg2-didi-ege6056fh856', NULL, NULL, 'EXP001', 'bank_transfer', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), '2025-08-17 08:30:00'),
  (gen_random_uuid(), 'expense', '8000.00', '6.15', 'Equipment maintenance', '6464cdf6-g8ag-6ae0-bgcg-cfc4834df634', NULL, NULL, 'EXP002', 'check', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), '2025-08-18 12:00:00');

-- Update the admin profile with proper details
UPDATE profiles 
SET 
  first_name = 'Ayu',
  last_name = 'T',
  username = 'ayuu',
  location = 'usa'
WHERE role = 'admin' AND first_name IS NULL;
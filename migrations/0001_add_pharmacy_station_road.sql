-- Migration: Add Pharmacy - Station Road department
-- Description: Adds a second pharmacy location to track revenue independently
-- Date: 2025-11-12

-- Insert the new department (idempotent using ON CONFLICT)
INSERT INTO departments (code, name, is_active)
VALUES ('PHARMACY_SR', 'Pharmacy - Station Road', true)
ON CONFLICT (code) DO NOTHING;

-- Verification: Check if the department was inserted
SELECT id, code, name, is_active
FROM departments
WHERE code = 'PHARMACY_SR';

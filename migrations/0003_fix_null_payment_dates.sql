-- Migration: Fix NULL payment_date values
-- Description: Updates existing payments with NULL payment_date to use created_at value
-- Date: 2025-12-01

-- Fix NULL payment_date values by setting them to created_at
UPDATE insurance_payments 
SET payment_date = created_at 
WHERE payment_date IS NULL;

-- Ensure payment_date cannot be NULL going forward
ALTER TABLE insurance_payments 
ALTER COLUMN payment_date SET NOT NULL;

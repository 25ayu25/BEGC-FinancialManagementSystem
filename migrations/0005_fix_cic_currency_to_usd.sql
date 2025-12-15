-- Migration: Fix CIC currency from SSP to USD
-- CIC claims and remittances should be in USD, not SSP
-- This migration updates any existing CIC data that has SSP currency to USD

-- Update CIC claims with SSP currency to USD
UPDATE claim_recon_claims
SET currency = 'USD'
WHERE provider_name = 'CIC' AND currency = 'SSP';

-- Update CIC remittances with SSP currency to USD
UPDATE claim_recon_remittances
SET currency = 'USD'
WHERE provider_name = 'CIC' AND currency = 'SSP';

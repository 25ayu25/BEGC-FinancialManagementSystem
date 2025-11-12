-- Deactivate "Other" department (soft delete to preserve historical data)
UPDATE departments SET is_active = false WHERE code = 'OTHER';

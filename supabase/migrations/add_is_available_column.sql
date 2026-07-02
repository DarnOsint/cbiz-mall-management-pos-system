-- Add is_available column to menu_items (frontend uses this, DB only had is_active)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true;

-- Sync existing is_active values into is_available
UPDATE menu_items SET is_available = is_active WHERE is_available IS DISTINCT FROM is_active;

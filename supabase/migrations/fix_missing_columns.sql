-- WARNING: This migration references tables/columns dropped by 20260720_restaurant_to_mall_pos.sql.
-- Do NOT run on a clean database after that migration.

-- Add missing columns used by the frontend

ALTER TABLE orders ADD COLUMN IF NOT EXISTS covers integer DEFAULT 1;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS return_reason text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS notes text;

-- Add is_available column to menu_items (frontend uses this, DB only had is_active)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true;

-- Sync existing is_active values into is_available
UPDATE menu_items SET is_available = is_active WHERE is_available IS DISTINCT FROM is_active;

-- Drop old RLS policies (replaced by rls_fix_all_tables.sql)
DROP POLICY IF EXISTS "menu_categories_read_all" ON public.menu_categories;
DROP POLICY IF EXISTS "menu_items_read_all" ON public.menu_items;

-- C.Biz Mall POS — Schema migration from Restaurant to Mall POS
-- Run this migration to remove restaurant-specific tables and adapt schema for mall POS

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. DROP RESTAURANT-SPECIFIC TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Kitchen/Bar operations
DROP TABLE IF EXISTS public.kitchen_stock CASCADE;
DROP TABLE IF EXISTS public.kitchen_stock_benchmarks CASCADE;
DROP TABLE IF EXISTS public.bar_chiller_stock CASCADE;
DROP TABLE IF EXISTS public.bar_issue_log CASCADE;
DROP TABLE IF EXISTS public.kitchen_fridge_log CASCADE;
DROP TABLE IF EXISTS public.store_requests CASCADE;

-- Delivery
DROP TABLE IF EXISTS public.boda_operators CASCADE;

-- Games
DROP TABLE IF EXISTS public.game_types CASCADE;
DROP TABLE IF EXISTS public.game_sales CASCADE;

-- Shisha
DROP TABLE IF EXISTS public.shisha_variants CASCADE;
DROP TABLE IF EXISTS public.shisha_sales CASCADE;

-- Zone/Table system
DROP TABLE IF EXISTS public.menu_item_zone_prices CASCADE;
DROP TABLE IF EXISTS public.zone_assignments CASCADE;
DROP TABLE IF EXISTS public.tables CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;

-- KDS workflow
DROP TABLE IF EXISTS public.void_requests CASCADE;
DROP TABLE IF EXISTS public.returns_log CASCADE;
DROP TABLE IF EXISTS public.waiter_calls CASCADE;
DROP TABLE IF EXISTS public.service_ratings CASCADE;
DROP TABLE IF EXISTS public.service_log CASCADE;

-- Tips
DROP TABLE IF EXISTS public.tips CASCADE;

-- Hotel rooms
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.room_stays CASCADE;

-- CCTV/Computer Vision
DROP TABLE IF EXISTS public.cv_people_counts CASCADE;
DROP TABLE IF EXISTS public.cv_alerts CASCADE;
DROP TABLE IF EXISTS public.cv_zone_heatmaps CASCADE;
DROP TABLE IF EXISTS public.cv_till_events CASCADE;
DROP TABLE IF EXISTS public.cv_shelf_events CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RENAME MENU TABLES TO ITEMS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS public.menu_categories RENAME TO item_categories;
ALTER TABLE IF EXISTS public.menu_items RENAME TO item;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. ALTER item_categories (was menu_categories)
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove destination column (kitchen/bar/griller concept)
ALTER TABLE public.item_categories DROP COLUMN IF EXISTS destination;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. ALTER item (was menu_items)
-- ═══════════════════════════════════════════════════════════════════════════

-- Add mall POS columns
ALTER TABLE public.item ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE public.item ADD COLUMN IF NOT EXISTS stock_quantity numeric(12,2) DEFAULT 0;
ALTER TABLE public.item ADD COLUMN IF NOT EXISTS low_stock_threshold numeric(12,2) DEFAULT 5;

-- Update category FK if needed (menu_categories → item_categories)
-- The FK name may vary; recreate if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'menu_items_category_id_fkey') THEN
    ALTER TABLE public.item DROP CONSTRAINT IF EXISTS menu_items_category_id_fkey;
    ALTER TABLE public.item ADD CONSTRAINT item_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.item_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. ALTER orders
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove restaurant columns
ALTER TABLE public.orders DROP COLUMN IF EXISTS table_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS covers;
ALTER TABLE public.orders DROP COLUMN IF EXISTS boda_operator_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS delivery_area;
ALTER TABLE public.orders DROP COLUMN IF EXISTS delivery_status;
ALTER TABLE public.orders DROP COLUMN IF EXISTS delivery_fee;
ALTER TABLE public.orders DROP COLUMN IF EXISTS payment_received_at;

-- Simplify order_type
ALTER TABLE public.orders ALTER COLUMN order_type SET DEFAULT 'sale';
-- Update existing data
UPDATE public.orders SET order_type = 'sale' WHERE order_type = 'dine-in';
UPDATE public.orders SET order_type = 'sale' WHERE order_type = 'takeaway';
UPDATE public.orders SET order_type = 'sale' WHERE order_type = 'delivery';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. ALTER order_items
-- ═══════════════════════════════════════════════════════════════════════════

-- Rename menu_item_id → item_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'menu_item_id') THEN
    ALTER TABLE public.order_items RENAME COLUMN menu_item_id TO item_id;
  END IF;
END $$;

-- Remove restaurant columns
ALTER TABLE public.order_items DROP COLUMN IF EXISTS destination;
ALTER TABLE public.order_items DROP COLUMN IF EXISTS extra_charge;
ALTER TABLE public.order_items DROP COLUMN IF EXISTS return_requested;
ALTER TABLE public.order_items DROP COLUMN IF EXISTS return_accepted;
ALTER TABLE public.order_items DROP COLUMN IF EXISTS return_reason;
ALTER TABLE public.order_items DROP COLUMN IF EXISTS return_requested_at;
ALTER TABLE public.order_items DROP COLUMN IF EXISTS return_accepted_at;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. ALTER inventory — remove menu_item_id FK
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.inventory DROP COLUMN IF EXISTS menu_item_id;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. ALTER print_jobs — simplify type CHECK
-- ═══════════════════════════════════════════════════════════════════════════

-- Update existing print job types
UPDATE public.print_jobs SET type = 'internal' WHERE type = 'waiter';
UPDATE public.print_jobs SET type = 'internal' WHERE type = 'kitchen';
UPDATE public.print_jobs SET type = 'internal' WHERE type = 'bar';

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. UPDATE settings
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.settings SET value = '"C.Biz POS"' WHERE id = 'business_name';
DELETE FROM public.settings WHERE id = 'floor_plan_layout';

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. CLEAN UP SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove restaurant seed data from item_categories
DELETE FROM public.item_categories WHERE destination IN ('kitchen', 'bar', 'griller');
DELETE FROM public.item_categories WHERE name IN ('Shisha', 'Games', 'Cocktails', 'Mocktails');

-- Remove restaurant items (keep only if they exist with restaurant names)
DELETE FROM public.item WHERE category_id IN (
  SELECT id FROM public.item_categories WHERE name IN ('Shisha', 'Games')
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. UPDATE RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop policies for deleted tables
DROP POLICY IF EXISTS "Full access for authenticated on kitchen_stock" ON public.kitchen_stock;
DROP POLICY IF EXISTS "Full access for authenticated on bar_chiller_stock" ON public.bar_chiller_stock;
DROP POLICY IF EXISTS "Full access for authenticated on bar_issue_log" ON public.bar_issue_log;
DROP POLICY IF EXISTS "Full access for authenticated on boda_operators" ON public.boda_operators;
DROP POLICY IF EXISTS "Full access for authenticated on game_types" ON public.game_types;
DROP POLICY IF EXISTS "Full access for authenticated on game_sales" ON public.game_sales;
DROP POLICY IF EXISTS "Full access for authenticated on shisha_variants" ON public.shisha_variants;
DROP POLICY IF EXISTS "Full access for authenticated on shisha_sales" ON public.shisha_sales;
DROP POLICY IF EXISTS "Full access for authenticated on tables" ON public.tables;
DROP POLICY IF EXISTS "Full access for authenticated on waiter_calls" ON public.waiter_calls;
DROP POLICY IF EXISTS "Full access for authenticated on service_log" ON public.service_log;

-- Done

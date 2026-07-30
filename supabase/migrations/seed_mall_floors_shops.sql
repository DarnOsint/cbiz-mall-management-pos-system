-- C.Biz Mall Management — Floors & Shops Seed
-- Run this in Supabase SQL Editor

-- Add shop-specific columns to the tables table
ALTER TABLE tables ADD COLUMN IF NOT EXISTS shop_number text;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS size_sqm numeric(8,2) DEFAULT 20.00;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS tenant_name text;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS tenant_phone text;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS tenant_email text;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS lease_start date;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS lease_end date;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS floor text;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS category text DEFAULT 'shop' CHECK (category IN ('shop', 'restroom', 'elevator', 'staircase', 'escalator', 'entrance', 'common', 'storage', 'kiosk'));

-- Create floor categories
INSERT INTO table_categories (name, hire_fee, min_spend) VALUES
  ('Ground Floor', 0, 0),
  ('First Floor', 0, 0),
  ('Second Floor', 0, 0)
ON CONFLICT DO NOTHING;

-- Get floor category IDs
DO $$
DECLARE
  ground_id uuid;
  first_id uuid;
  second_id uuid;
  i integer;
  shop_name text;
  shop_num text;
  existing_count integer;
BEGIN
  SELECT id INTO ground_id FROM table_categories WHERE name = 'Ground Floor' LIMIT 1;
  SELECT id INTO first_id FROM table_categories WHERE name = 'First Floor' LIMIT 1;
  SELECT id INTO second_id FROM table_categories WHERE name = 'Second Floor' LIMIT 1;

  -- Count existing shops per floor to avoid duplicates
  SELECT COUNT(*) INTO existing_count FROM tables WHERE category_id = first_id;

  -- Ground Floor — 50 shops (G-01 to G-50)
  IF ground_id IS NOT NULL THEN
    FOR i IN 1..50 LOOP
      shop_num := 'G-' || LPAD(i::text, 2, '0');
      shop_name := 'Shop ' || shop_num;
      INSERT INTO tables (name, capacity, status, category_id, shop_number, size_sqm, floor)
      VALUES (shop_name, 20, 'available', ground_id, shop_num, 20.00 + (random() * 30)::int, 'Ground Floor')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- First Floor — 50 shops (1-01 to 1-50), skip if 2 already exist
  IF first_id IS NOT NULL THEN
    FOR i IN (1 + existing_count)..50 LOOP
      shop_num := '1-' || LPAD(i::text, 2, '0');
      shop_name := 'Shop ' || shop_num;
      INSERT INTO tables (name, capacity, status, category_id, shop_number, size_sqm, floor)
      VALUES (shop_name, 20, 'available', first_id, shop_num, 20.00 + (random() * 30)::int, 'First Floor')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Second Floor — 50 shops (2-01 to 2-50)
  IF second_id IS NOT NULL THEN
    FOR i IN 1..50 LOOP
      shop_num := '2-' || LPAD(i::text, 2, '0');
      shop_name := 'Shop ' || shop_num;
      INSERT INTO tables (name, capacity, status, category_id, shop_number, size_sqm, floor)
      VALUES (shop_name, 20, 'available', second_id, shop_num, 20.00 + (random() * 30)::int, 'Second Floor')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

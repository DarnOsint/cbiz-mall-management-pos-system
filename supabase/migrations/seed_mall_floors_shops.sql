-- C.Biz Mall Management — Floors & 150 Shops Seed
-- Run this in Supabase SQL Editor

-- Create floors if they don't exist
ALTER TABLE mall_floors ADD CONSTRAINT mall_floors_name_key UNIQUE (name);
INSERT INTO mall_floors (name, floor_number) VALUES
  ('Ground Floor', 0),
  ('First Floor', 1),
  ('Second Floor', 2)
ON CONFLICT (name) DO NOTHING;

-- Ensure shop_number is unique for idempotent re-runs
ALTER TABLE mall_shops ADD CONSTRAINT mall_shops_shop_number_key UNIQUE (shop_number);

-- Seed 150 shops (50 per floor)
DO $$
DECLARE
  ground_id uuid;
  first_id uuid;
  second_id uuid;
  i integer;
  r integer;
  c integer;
  shop_num text;
  shop_name text;
  x_pos integer;
  y_pos integer;
  rent numeric;
  cat text;
  categories text[] := ARRAY['Fashion', 'Electronics', 'Food & Beverage', 'Home & Living', 'Health & Beauty'];
BEGIN
  SELECT id INTO ground_id FROM mall_floors WHERE name = 'Ground Floor' LIMIT 1;
  SELECT id INTO first_id  FROM mall_floors WHERE name = 'First Floor'  LIMIT 1;
  SELECT id INTO second_id FROM mall_floors WHERE name = 'Second Floor' LIMIT 1;

  -- Layout: 10 cols x 5 rows = 50 shops per floor
  -- Each shop 2x2 units, 3 unit spacing

  -- Ground Floor (G-01 to G-50)
  FOR i IN 1..50 LOOP
    r := ((i - 1) / 10);
    c := ((i - 1) % 10);
    x_pos := c * 3;
    y_pos := r * 3;
    shop_num := 'G-' || LPAD(i::text, 2, '0');
    shop_name := 'Shop ' || shop_num;
    rent := 500 + (random() * 3000)::int;
    cat := categories[1 + (random() * 4)::int];
    INSERT INTO mall_shops (shop_number, shop_name, floor_id, pos_x, pos_y, width, height, monthly_rent, shop_category, is_occupied)
    VALUES (shop_num, shop_name, ground_id, x_pos, y_pos, 2, 2, rent, cat, random() > 0.3)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- First Floor (1-01 to 1-50)
  FOR i IN 1..50 LOOP
    r := ((i - 1) / 10);
    c := ((i - 1) % 10);
    x_pos := c * 3;
    y_pos := r * 3;
    shop_num := '1-' || LPAD(i::text, 2, '0');
    shop_name := 'Shop ' || shop_num;
    rent := 600 + (random() * 4000)::int;
    cat := categories[1 + (random() * 4)::int];
    INSERT INTO mall_shops (shop_number, shop_name, floor_id, pos_x, pos_y, width, height, monthly_rent, shop_category, is_occupied)
    VALUES (shop_num, shop_name, first_id, x_pos, y_pos, 2, 2, rent, cat, random() > 0.3)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Second Floor (2-01 to 2-50)
  FOR i IN 1..50 LOOP
    r := ((i - 1) / 10);
    c := ((i - 1) % 10);
    x_pos := c * 3;
    y_pos := r * 3;
    shop_num := '2-' || LPAD(i::text, 2, '0');
    shop_name := 'Shop ' || shop_num;
    rent := 400 + (random() * 2500)::int;
    cat := categories[1 + (random() * 4)::int];
    INSERT INTO mall_shops (shop_number, shop_name, floor_id, pos_x, pos_y, width, height, monthly_rent, shop_category, is_occupied)
    VALUES (shop_num, shop_name, second_id, x_pos, y_pos, 2, 2, rent, cat, random() > 0.3)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

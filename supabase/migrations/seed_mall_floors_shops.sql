-- C.Biz Mall Management — Floors & 150 Shops Seed
-- Run this in Supabase SQL Editor

-- Create floors if they don't exist
INSERT INTO mall_floors (name, floor_number)
SELECT 'Ground Floor', 0 WHERE NOT EXISTS (SELECT 1 FROM mall_floors WHERE name = 'Ground Floor');
INSERT INTO mall_floors (name, floor_number)
SELECT 'First Floor', 1 WHERE NOT EXISTS (SELECT 1 FROM mall_floors WHERE name = 'First Floor');
INSERT INTO mall_floors (name, floor_number)
SELECT 'Second Floor', 2 WHERE NOT EXISTS (SELECT 1 FROM mall_floors WHERE name = 'Second Floor');

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
  existing_shops integer;
BEGIN
  SELECT id INTO ground_id FROM mall_floors WHERE name = 'Ground Floor' LIMIT 1;
  SELECT id INTO first_id  FROM mall_floors WHERE name = 'First Floor'  LIMIT 1;
  SELECT id INTO second_id FROM mall_floors WHERE name = 'Second Floor' LIMIT 1;

  -- Layout: 10 cols x 5 rows = 50 shops per floor
  -- Each shop 2x2 units, 3 unit spacing

  -- Ground Floor (G-01 to G-50)
  SELECT COUNT(*) INTO existing_shops FROM mall_shops WHERE floor_id = ground_id;
  IF existing_shops = 0 THEN
    FOR i IN 1..50 LOOP
      r := ((i - 1) / 10);
      c := ((i - 1) % 10);
      x_pos := c * 55;
      y_pos := r * 55;
      shop_num := 'G-' || LPAD(i::text, 2, '0');
      shop_name := shop_num;
      rent := 500 + (random() * 3000)::int;
      cat := categories[1 + (random() * 4)::int];
      INSERT INTO mall_shops (shop_number, shop_name, floor_id, pos_x, pos_y, width, height, monthly_rent, shop_category, is_occupied)
      VALUES (shop_num, shop_name, ground_id, x_pos, y_pos, 50, 50, rent, cat, random() > 0.3);
    END LOOP;
  END IF;

  -- First Floor (1-01 to 1-50)
  SELECT COUNT(*) INTO existing_shops FROM mall_shops WHERE floor_id = first_id;
  IF existing_shops = 0 THEN
    FOR i IN 1..50 LOOP
      r := ((i - 1) / 10);
      c := ((i - 1) % 10);
      x_pos := c * 55;
      y_pos := r * 55;
      shop_num := '1-' || LPAD(i::text, 2, '0');
      shop_name := shop_num;
      rent := 600 + (random() * 4000)::int;
      cat := categories[1 + (random() * 4)::int];
      INSERT INTO mall_shops (shop_number, shop_name, floor_id, pos_x, pos_y, width, height, monthly_rent, shop_category, is_occupied)
      VALUES (shop_num, shop_name, first_id, x_pos, y_pos, 50, 50, rent, cat, random() > 0.3);
    END LOOP;
  END IF;

  -- Second Floor (2-01 to 2-50)
  SELECT COUNT(*) INTO existing_shops FROM mall_shops WHERE floor_id = second_id;
  IF existing_shops = 0 THEN
    FOR i IN 1..50 LOOP
      r := ((i - 1) / 10);
      c := ((i - 1) % 10);
      x_pos := c * 55;
      y_pos := r * 55;
      shop_num := '2-' || LPAD(i::text, 2, '0');
      shop_name := shop_num;
      rent := 400 + (random() * 2500)::int;
      cat := categories[1 + (random() * 4)::int];
      INSERT INTO mall_shops (shop_number, shop_name, floor_id, pos_x, pos_y, width, height, monthly_rent, shop_category, is_occupied)
      VALUES (shop_num, shop_name, second_id, x_pos, y_pos, 50, 50, rent, cat, random() > 0.3);
    END LOOP;
  END IF;
END $$;

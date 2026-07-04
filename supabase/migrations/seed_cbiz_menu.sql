-- Celebiz Restaurant OS — Seed Menu: Food & Drinks categories + all meal items
-- Run this in Supabase SQL editor (Dashboard → SQL Editor)
-- Safe to re-run: deletes existing menu data first

-- 1. Clear existing menu data (order matters for FK constraints)
DELETE FROM menu_item_zone_prices;
DELETE FROM inventory;
DELETE FROM kitchen_stock;
DELETE FROM order_items;
DELETE FROM menu_items;
DELETE FROM menu_categories;

-- 2. Create the two categories
INSERT INTO menu_categories (name, destination, sort_order) VALUES
  ('Food', 'kitchen', 1),
  ('Drinks', 'bar', 2);

-- 3. Insert all meal items under Food (prices set to 0 — add later)
DO $$
DECLARE
  food_id uuid;
BEGIN
  SELECT id INTO food_id FROM menu_categories WHERE name = 'Food';

  INSERT INTO menu_items (name, category_id, price, description, is_available, sort_order) VALUES
    -- Monday
    ('Rice and Vegetable Sauce',     food_id, 0, 'Monday Morning', true, 1),
    ('Egusi Soup and Semo',          food_id, 0, 'Monday Afternoon', true, 2),
    ('Spaghetti Jolly',              food_id, 0, 'Monday Evening', true, 3),
    -- Tuesday
    ('Special Fried Rice',           food_id, 0, 'Tuesday Morning', true, 4),
    ('C.Biz Special Okro',            food_id, 0, 'Tuesday Afternoon', true, 5),
    ('Stir Fry Spaghetti',           food_id, 0, 'Tuesday Evening', true, 6),
    -- Wednesday
    ('Yam and Egg Sauce',            food_id, 0, 'Wednesday Morning', true, 7),
    ('Native Rice',                  food_id, 0, 'Wednesday Afternoon', true, 8),
    ('Ogbono Soup',                  food_id, 0, 'Wednesday Evening', true, 9),
    -- Thursday
    ('Ofeakwu and Rice',             food_id, 0, 'Thursday Morning', true, 10),
    ('Bitterleaf Soup',              food_id, 0, 'Thursday Afternoon', true, 11),
    ('C.Biz Coconut Rice',            food_id, 0, 'Thursday Evening', true, 12),
    -- Friday
    ('Peppersoup and White Rice',    food_id, 0, 'Friday Morning', true, 13),
    ('Nsala Soup',                   food_id, 0, 'Friday Afternoon', true, 14),
    ('Garnished Jollof Rice',        food_id, 0, 'Friday Evening', true, 15),
    -- Saturday
    ('Peppersoup and Plantain',      food_id, 0, 'Saturday Morning', true, 16),
    ('Vegetable Soup and Semo',      food_id, 0, 'Saturday Afternoon', true, 17),
    ('Asun Rice',                    food_id, 0, 'Saturday Evening', true, 18),
    -- Sunday
    ('Rice and Stew',                food_id, 0, 'Sunday Morning', true, 19),
    ('Native Soup and Semo',         food_id, 0, 'Sunday Afternoon', true, 20),
    ('Fisherman Soup',               food_id, 0, 'Sunday Evening', true, 21);
END $$;

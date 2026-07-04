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
    ('Rice and Vegetable Sauce',     food_id, 5.00, 'Monday Morning', true, 1),
    ('Egusi Soup and Semo',          food_id, 6.50, 'Monday Afternoon', true, 2),
    ('Spaghetti Jolly',              food_id, 5.50, 'Monday Evening', true, 3),
    -- Tuesday
    ('Special Fried Rice',           food_id, 6.00, 'Tuesday Morning', true, 4),
    ('C.Biz Special Okro',           food_id, 7.00, 'Tuesday Afternoon', true, 5),
    ('Stir Fry Spaghetti',           food_id, 5.50, 'Tuesday Evening', true, 6),
    -- Wednesday
    ('Yam and Egg Sauce',            food_id, 4.50, 'Wednesday Morning', true, 7),
    ('Native Rice',                  food_id, 5.00, 'Wednesday Afternoon', true, 8),
    ('Ogbono Soup',                  food_id, 6.50, 'Wednesday Evening', true, 9),
    -- Thursday
    ('Ofeakwu and Rice',             food_id, 5.00, 'Thursday Morning', true, 10),
    ('Bitterleaf Soup',              food_id, 6.50, 'Thursday Afternoon', true, 11),
    ('C.Biz Coconut Rice',           food_id, 6.00, 'Thursday Evening', true, 12),
    -- Friday
    ('Peppersoup and White Rice',    food_id, 5.50, 'Friday Morning', true, 13),
    ('Nsala Soup',                   food_id, 6.50, 'Friday Afternoon', true, 14),
    ('Garnished Jollof Rice',        food_id, 6.00, 'Friday Evening', true, 15),
    -- Saturday
    ('Peppersoup and Plantain',      food_id, 5.00, 'Saturday Morning', true, 16),
    ('Vegetable Soup and Semo',      food_id, 6.50, 'Saturday Afternoon', true, 17),
    ('Asun Rice',                    food_id, 6.00, 'Saturday Evening', true, 18),
    -- Sunday
    ('Rice and Stew',                food_id, 5.00, 'Sunday Morning', true, 19),
    ('Native Soup and Semo',         food_id, 6.50, 'Sunday Afternoon', true, 20),
    ('Fisherman Soup',               food_id, 7.00, 'Sunday Evening', true, 21);

  -- Drinks
  INSERT INTO menu_items (name, category_id, price, description, is_available, sort_order) VALUES
    ('Star Lager',                   (SELECT id FROM menu_categories WHERE name = 'Drinks'), 2.50, 'Bottle', true, 1),
    ('Gulder',                       (SELECT id FROM menu_categories WHERE name = 'Drinks'), 2.50, 'Bottle', true, 2),
    ('Heineken',                     (SELECT id FROM menu_categories WHERE name = 'Drinks'), 3.00, 'Bottle', true, 3),
    ('Trophy Stout',                 (SELECT id FROM menu_categories WHERE name = 'Drinks'), 2.50, 'Bottle', true, 4),
    ('Smirnoff Ice',                 (SELECT id FROM menu_categories WHERE name = 'Drinks'), 3.00, 'Bottle', true, 5),
    ('Maltina',                      (SELECT id FROM menu_categories WHERE name = 'Drinks'), 1.50, 'Can', true, 6),
    ('Coca-Cola',                    (SELECT id FROM menu_categories WHERE name = 'Drinks'), 1.00, 'Can', true, 7),
    ('Fanta',                        (SELECT id FROM menu_categories WHERE name = 'Drinks'), 1.00, 'Can', true, 8),
    ('Sprite',                       (SELECT id FROM menu_categories WHERE name = 'Drinks'), 1.00, 'Can', true, 9),
    ('Bottled Water',                (SELECT id FROM menu_categories WHERE name = 'Drinks'), 0.75, '750ml', true, 10);
END $$;

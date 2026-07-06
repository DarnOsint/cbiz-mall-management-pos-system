-- Celebiz Restaurant OS — Seed: Takeaway Pack menu item
-- Adds a "Takeaway" category and a single "Takeaway Pack" item at 3,000 SSP
-- Safe to re-run: uses ON CONFLICT DO NOTHING

INSERT INTO menu_categories (name, destination, sort_order)
VALUES ('Takeaway', 'kitchen', 3)
ON CONFLICT (name) DO NOTHING;

INSERT INTO menu_items (name, category_id, price, description, is_available, sort_order)
SELECT 'Takeaway Pack', id, 3000.00, 'Packed meal to go', true, 1
FROM menu_categories
WHERE name = 'Takeaway'
ON CONFLICT DO NOTHING;

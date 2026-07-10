-- Seed zones: Inside & Outside
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)

DELETE FROM zone_assignments;
DELETE FROM tables;
DELETE FROM table_categories;

INSERT INTO table_categories (name, hire_fee, min_spend) VALUES
  ('Inside', 0, 0),
  ('Outside', 0, 0),
  ('VIP', 25000, 50000);

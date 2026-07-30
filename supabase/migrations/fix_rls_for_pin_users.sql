-- WARNING: This migration references tables/columns dropped by 20260720_restaurant_to_mall_pos.sql.
-- Do NOT run on a clean database after that migration.

-- Fix RLS policies for PIN-based waitron access
-- PIN users have no Supabase auth session — they use the anon key (JWT role: 'anon')
-- Policies using auth.role() = 'authenticated' block all anon access
-- Solution: drop restrictive policies, create public (true) policies for tables PIN users need

-- TABLES
DROP POLICY IF EXISTS tables_select ON tables;
DROP POLICY IF EXISTS "tables_read_all" ON tables;
CREATE POLICY tables_select ON tables FOR SELECT USING (true);
CREATE POLICY tables_update ON tables FOR UPDATE USING (true);

-- MENU ITEMS
DROP POLICY IF EXISTS menu_items_select ON menu_items;
DROP POLICY IF EXISTS "menu_items_read_all" ON menu_items;
CREATE POLICY menu_items_select ON menu_items FOR SELECT USING (true);

-- MENU CATEGORIES
DROP POLICY IF EXISTS menu_categories_select ON menu_categories;
DROP POLICY IF EXISTS "menu_categories_read_all" ON menu_categories;
CREATE POLICY menu_categories_select ON menu_categories FOR SELECT USING (true);

-- TABLE CATEGORIES (zones)
DROP POLICY IF EXISTS table_categories_select ON table_categories;
DROP POLICY IF EXISTS "table_categories_read_all" ON table_categories;
CREATE POLICY table_categories_select ON table_categories FOR SELECT USING (true);

-- ZONE ASSIGNMENTS
DROP POLICY IF EXISTS zone_assignments_select ON zone_assignments;
DROP POLICY IF EXISTS "zone_assignments_read_all" ON zone_assignments;
CREATE POLICY zone_assignments_select ON zone_assignments FOR SELECT USING (true);

-- MENU ITEM ZONE PRICES
DROP POLICY IF EXISTS zone_prices_select ON menu_item_zone_prices;
DROP POLICY IF EXISTS "zone_prices_read_all" ON menu_item_zone_prices;
CREATE POLICY zone_prices_select ON menu_item_zone_prices FOR SELECT USING (true);

-- ATTENDANCE — PIN users need read, insert (clock-in), update (clock-out)
DROP POLICY IF EXISTS attendance_select ON attendance;
DROP POLICY IF EXISTS attendance_read ON attendance;
DROP POLICY IF EXISTS "attendance_read" ON attendance;
CREATE POLICY attendance_select ON attendance FOR SELECT USING (true);
DROP POLICY IF EXISTS attendance_insert ON attendance;
DROP POLICY IF EXISTS "attendance_insert" ON attendance;
CREATE POLICY attendance_insert ON attendance FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS attendance_update ON attendance;
DROP POLICY IF EXISTS "attendance_update" ON attendance;
CREATE POLICY attendance_update ON attendance FOR UPDATE USING (true);

-- INVENTORY — stock display for menu items
DROP POLICY IF EXISTS inventory_select ON inventory;
DROP POLICY IF EXISTS inventory_read ON inventory;
DROP POLICY IF EXISTS "inventory_read" ON inventory;
CREATE POLICY inventory_select ON inventory FOR SELECT USING (true);

-- BAR ISSUE LOG
DROP POLICY IF EXISTS authenticated_select_bar_issue_log ON bar_issue_log;
DROP POLICY IF EXISTS authenticated_insert_bar_issue_log ON bar_issue_log;
CREATE POLICY bar_issue_log_select ON bar_issue_log FOR SELECT USING (true);
CREATE POLICY bar_issue_log_insert ON bar_issue_log FOR INSERT WITH CHECK (true);

-- WAITER CALLS — currently restricted to {authenticated} role only
DROP POLICY IF EXISTS waiter_calls_read ON waiter_calls;
DROP POLICY IF EXISTS "Staff can read waiter_calls" ON waiter_calls;
DROP POLICY IF EXISTS "waiter_calls_read" ON waiter_calls;
CREATE POLICY waiter_calls_select ON waiter_calls FOR SELECT USING (true);
DROP POLICY IF EXISTS waiter_calls_insert ON waiter_calls;
DROP POLICY IF EXISTS "Staff can insert waiter_calls" ON waiter_calls;
DROP POLICY IF EXISTS "waiter_calls_insert" ON waiter_calls;
CREATE POLICY waiter_calls_insert ON waiter_calls FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS waiter_calls_update ON waiter_calls;
DROP POLICY IF EXISTS "Staff can update waiter_calls" ON waiter_calls;
DROP POLICY IF EXISTS "waiter_calls_update" ON waiter_calls;
CREATE POLICY waiter_calls_update ON waiter_calls FOR UPDATE USING (true);

-- ORDERS — PIN users need full CRUD to operate POS
DROP POLICY IF EXISTS orders_read_all ON orders;
DROP POLICY IF EXISTS "orders_read_all" ON orders;
CREATE POLICY orders_read_all ON orders FOR SELECT USING (true);
DROP POLICY IF EXISTS orders_insert_all ON orders;
DROP POLICY IF EXISTS "orders_insert_all" ON orders;
CREATE POLICY orders_insert_all ON orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS orders_update_all ON orders;
DROP POLICY IF EXISTS "orders_update_all" ON orders;
CREATE POLICY orders_update_all ON orders FOR UPDATE USING (true);

-- ORDER ITEMS
DROP POLICY IF EXISTS order_items_read ON order_items;
DROP POLICY IF EXISTS "order_items_read" ON order_items;
CREATE POLICY order_items_read ON order_items FOR SELECT USING (true);
DROP POLICY IF EXISTS order_items_insert ON order_items;
DROP POLICY IF EXISTS "order_items_insert" ON order_items;
CREATE POLICY order_items_insert ON order_items FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS order_items_update ON order_items;
DROP POLICY IF EXISTS "order_items_update" ON order_items;
CREATE POLICY order_items_update ON order_items FOR UPDATE USING (true);

-- INVENTORY LOG — needed for stock deduction at payment
DROP POLICY IF EXISTS inventory_log_select ON inventory_log;
DROP POLICY IF EXISTS inventory_log_read ON inventory_log;
DROP POLICY IF EXISTS "inventory_log_read" ON inventory_log;
CREATE POLICY inventory_log_select ON inventory_log FOR SELECT USING (true);
DROP POLICY IF EXISTS inventory_log_insert ON inventory_log;
DROP POLICY IF EXISTS "inventory_log_insert" ON inventory_log;
CREATE POLICY inventory_log_insert ON inventory_log FOR INSERT WITH CHECK (true);

-- BAR CHILLER STOCK
DROP POLICY IF EXISTS bar_chiller_stock_select ON bar_chiller_stock;
CREATE POLICY bar_chiller_stock_select ON bar_chiller_stock FOR SELECT USING (true);
DROP POLICY IF EXISTS bar_chiller_stock_insert ON bar_chiller_stock;
CREATE POLICY bar_chiller_stock_insert ON bar_chiller_stock FOR INSERT WITH CHECK (true);

-- SETTINGS — already has read policy with true, but ensure settings_read_all doesn't override
DROP POLICY IF EXISTS "settings_read_all" ON settings;

-- PROFILES — already has profiles_read with true, ensure the restrictive one is dropped
DROP POLICY IF EXISTS "profiles_read_own" ON profiles;

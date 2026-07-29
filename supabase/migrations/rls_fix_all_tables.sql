-- WARNING: This migration references tables/columns dropped by 20260720_restaurant_to_mall_pos.sql.
-- Do NOT run on a clean database after that migration.

-- Comprehensive RLS fix: add INSERT/UPDATE/DELETE policies for ALL tables
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to re-run: uses DROP IF EXISTS before each CREATE

-- ============================================
-- MENU CATEGORIES
-- ============================================
DROP POLICY IF EXISTS "menu_categories_read_all" ON public.menu_categories;
DROP POLICY IF EXISTS "menu_categories_select" ON public.menu_categories;
DROP POLICY IF EXISTS "menu_categories_insert" ON public.menu_categories;
DROP POLICY IF EXISTS "menu_categories_update" ON public.menu_categories;
DROP POLICY IF EXISTS "menu_categories_delete" ON public.menu_categories;

CREATE POLICY "menu_categories_select" ON public.menu_categories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "menu_categories_insert" ON public.menu_categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "menu_categories_update" ON public.menu_categories FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "menu_categories_delete" ON public.menu_categories FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- MENU ITEMS
-- ============================================
DROP POLICY IF EXISTS "menu_items_read_all" ON public.menu_items;
DROP POLICY IF EXISTS "menu_items_select" ON public.menu_items;
DROP POLICY IF EXISTS "menu_items_insert" ON public.menu_items;
DROP POLICY IF EXISTS "menu_items_update" ON public.menu_items;
DROP POLICY IF EXISTS "menu_items_delete" ON public.menu_items;

CREATE POLICY "menu_items_select" ON public.menu_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "menu_items_insert" ON public.menu_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "menu_items_update" ON public.menu_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "menu_items_delete" ON public.menu_items FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- MENU ITEM ZONE PRICES
-- ============================================
DROP POLICY IF EXISTS "zone_prices_read_all" ON public.menu_item_zone_prices;

CREATE POLICY "menu_item_zone_prices_select" ON public.menu_item_zone_prices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "menu_item_zone_prices_insert" ON public.menu_item_zone_prices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "menu_item_zone_prices_update" ON public.menu_item_zone_prices FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "menu_item_zone_prices_delete" ON public.menu_item_zone_prices FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- TABLE CATEGORIES (zones)
-- ============================================
DROP POLICY IF EXISTS "table_categories_read_all" ON public.table_categories;

CREATE POLICY "table_categories_select" ON public.table_categories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "table_categories_insert" ON public.table_categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "table_categories_update" ON public.table_categories FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "table_categories_delete" ON public.table_categories FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- TABLES
-- ============================================
DROP POLICY IF EXISTS "tables_read_all" ON public.tables;

CREATE POLICY "tables_select" ON public.tables FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tables_insert" ON public.tables FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "tables_update" ON public.tables FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "tables_delete" ON public.tables FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- ZONE ASSIGNMENTS
-- ============================================
DROP POLICY IF EXISTS "zone_assignments_read_all" ON public.zone_assignments;

CREATE POLICY "zone_assignments_select" ON public.zone_assignments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "zone_assignments_insert" ON public.zone_assignments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "zone_assignments_update" ON public.zone_assignments FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "zone_assignments_delete" ON public.zone_assignments FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- INVENTORY
-- ============================================
DROP POLICY IF EXISTS "inventory_read" ON public.inventory;

CREATE POLICY "inventory_select" ON public.inventory FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inventory_insert" ON public.inventory FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "inventory_update" ON public.inventory FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "inventory_delete" ON public.inventory FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- INVENTORY LOG — add UPDATE + DELETE
-- ============================================
DROP POLICY IF EXISTS "inventory_log_read" ON public.inventory_log;
DROP POLICY IF EXISTS "inventory_log_insert" ON public.inventory_log;

CREATE POLICY "inventory_log_select" ON public.inventory_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inventory_log_insert" ON public.inventory_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "inventory_log_update" ON public.inventory_log FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "inventory_log_delete" ON public.inventory_log FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- SUPPLIERS
-- ============================================
DROP POLICY IF EXISTS "suppliers_read" ON public.suppliers;

CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- PURCHASE ORDERS
-- ============================================
DROP POLICY IF EXISTS "purchase_orders_read" ON public.purchase_orders;

CREATE POLICY "purchase_orders_select" ON public.purchase_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "purchase_orders_insert" ON public.purchase_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "purchase_orders_update" ON public.purchase_orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "purchase_orders_delete" ON public.purchase_orders FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- RESTOCK LOG — add UPDATE + DELETE
-- ============================================
DROP POLICY IF EXISTS "restock_log_read" ON public.restock_log;
DROP POLICY IF EXISTS "restock_log_insert" ON public.restock_log;

CREATE POLICY "restock_log_select" ON public.restock_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "restock_log_insert" ON public.restock_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "restock_log_update" ON public.restock_log FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "restock_log_delete" ON public.restock_log FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- KITCHEN STOCK
-- ============================================
DROP POLICY IF EXISTS "kitchen_stock_read" ON public.kitchen_stock;

CREATE POLICY "kitchen_stock_select" ON public.kitchen_stock FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "kitchen_stock_insert" ON public.kitchen_stock FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "kitchen_stock_update" ON public.kitchen_stock FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "kitchen_stock_delete" ON public.kitchen_stock FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- ROOMS
-- ============================================
DROP POLICY IF EXISTS "rooms_read" ON public.rooms;

CREATE POLICY "rooms_select" ON public.rooms FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "rooms_insert" ON public.rooms FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "rooms_update" ON public.rooms FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "rooms_delete" ON public.rooms FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- ROOM STAYS
-- ============================================
DROP POLICY IF EXISTS "room_stays_read" ON public.room_stays;

CREATE POLICY "room_stays_select" ON public.room_stays FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "room_stays_insert" ON public.room_stays FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "room_stays_update" ON public.room_stays FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "room_stays_delete" ON public.room_stays FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- TILL SESSIONS
-- ============================================
DROP POLICY IF EXISTS "till_sessions_read" ON public.till_sessions;

CREATE POLICY "till_sessions_select" ON public.till_sessions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "till_sessions_insert" ON public.till_sessions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "till_sessions_update" ON public.till_sessions FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "till_sessions_delete" ON public.till_sessions FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- PAYOUTS — add INSERT, UPDATE, DELETE
-- ============================================
DROP POLICY IF EXISTS "payouts_read" ON public.payouts;

CREATE POLICY "payouts_select" ON public.payouts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "payouts_insert" ON public.payouts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "payouts_update" ON public.payouts FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "payouts_delete" ON public.payouts FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- VOID LOG — add UPDATE + DELETE
-- ============================================
DROP POLICY IF EXISTS "void_log_read" ON public.void_log;
DROP POLICY IF EXISTS "void_log_insert" ON public.void_log;

CREATE POLICY "void_log_select" ON public.void_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "void_log_insert" ON public.void_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "void_log_update" ON public.void_log FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "void_log_delete" ON public.void_log FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- DEBT PAYMENTS — add UPDATE + DELETE
-- ============================================
DROP POLICY IF EXISTS "debt_payments_read" ON public.debt_payments;
DROP POLICY IF EXISTS "debt_payments_insert" ON public.debt_payments;

CREATE POLICY "debt_payments_select" ON public.debt_payments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "debt_payments_insert" ON public.debt_payments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "debt_payments_update" ON public.debt_payments FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "debt_payments_delete" ON public.debt_payments FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- SERVICE LOG — add UPDATE + DELETE
-- ============================================
DROP POLICY IF EXISTS "service_log_read" ON public.service_log;
DROP POLICY IF EXISTS "service_log_insert" ON public.service_log;

CREATE POLICY "service_log_select" ON public.service_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "service_log_insert" ON public.service_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "service_log_update" ON public.service_log FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "service_log_delete" ON public.service_log FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- ORDERS — add DELETE
-- ============================================
DROP POLICY IF EXISTS "orders_read_all" ON public.orders;
DROP POLICY IF EXISTS "orders_delete" ON public.orders;

CREATE POLICY "orders_select" ON public.orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "orders_insert" ON public.orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "orders_update" ON public.orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "orders_delete" ON public.orders FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- ORDER ITEMS — add DELETE
-- ============================================
DROP POLICY IF EXISTS "order_items_read" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update" ON public.order_items;
DROP POLICY IF EXISTS "order_items_delete" ON public.order_items;

CREATE POLICY "order_items_select" ON public.order_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- ATTENDANCE — add DELETE
-- ============================================
DROP POLICY IF EXISTS "attendance_read" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert" ON public.attendance;
DROP POLICY IF EXISTS "attendance_update" ON public.attendance;
DROP POLICY IF EXISTS "attendance_delete" ON public.attendance;

CREATE POLICY "attendance_select" ON public.attendance FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "attendance_insert" ON public.attendance FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "attendance_update" ON public.attendance FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "attendance_delete" ON public.attendance FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- DEBTORS — add DELETE
-- ============================================
DROP POLICY IF EXISTS "debtors_read" ON public.debtors;
DROP POLICY IF EXISTS "debtors_insert" ON public.debtors;
DROP POLICY IF EXISTS "debtors_update" ON public.debtors;
DROP POLICY IF EXISTS "debtors_delete" ON public.debtors;

CREATE POLICY "debtors_select" ON public.debtors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "debtors_insert" ON public.debtors FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "debtors_update" ON public.debtors FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "debtors_delete" ON public.debtors FOR DELETE USING (auth.role() = 'authenticated');

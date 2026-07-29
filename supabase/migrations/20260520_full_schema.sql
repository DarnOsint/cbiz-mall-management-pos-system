-- WARNING: This migration references tables/columns dropped by 20260720_restaurant_to_mall_pos.sql.
-- Do NOT run on a clean database after that migration.

-- Celebiz Restaurant OS — Full Database Schema
-- Run this in Supabase SQL editor (Dashboard → SQL Editor)
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS and ALTER TABLE ADD COLUMN IF NOT EXISTS

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text,
  full_name       text,
  phone           text,
  role            text NOT NULL DEFAULT 'waitron' CHECK (role IN ('owner','manager','waitron','kitchen','bar')),
  pin             text,
  avatar_url      text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "profiles_read_own" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  id            text PRIMARY KEY,
  value         jsonb DEFAULT '{}',
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "settings_read_all" ON settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "settings_write_admin" ON settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager'))
);

-- ============================================
-- MENU CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS menu_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  destination   text NOT NULL DEFAULT 'kitchen' CHECK (destination IN ('kitchen','bar','griller')),
  sort_order    integer DEFAULT 0,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "menu_categories_read_all" ON menu_categories FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- MENU ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS menu_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  price           numeric(12,2) NOT NULL DEFAULT 0,
  cost_price      numeric(12,2),
  category_id     uuid REFERENCES menu_categories(id),
  image_url       text,
  is_active       boolean DEFAULT true,
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "menu_items_read_all" ON menu_items FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- MENU ITEM ZONE PRICES
-- ============================================
CREATE TABLE IF NOT EXISTS menu_item_zone_prices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id    uuid REFERENCES menu_items(id) ON DELETE CASCADE,
  category_id     uuid REFERENCES table_categories(id) ON DELETE CASCADE,
  price           numeric(12,2) NOT NULL,
  UNIQUE(menu_item_id, category_id)
);

ALTER TABLE menu_item_zone_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "zone_prices_read_all" ON menu_item_zone_prices FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- TABLE CATEGORIES (zones)
-- ============================================
CREATE TABLE IF NOT EXISTS table_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  hire_fee      numeric(12,2) DEFAULT 0,
  min_spend     numeric(12,2) DEFAULT 0,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE table_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "table_categories_read_all" ON table_categories FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- TABLES
-- ============================================
CREATE TABLE IF NOT EXISTS tables (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  capacity        integer DEFAULT 2,
  status          text DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','maintenance')),
  category_id     uuid REFERENCES table_categories(id),
  qr_code         text,
  assigned_staff  uuid REFERENCES profiles(id),
  pos_machine     text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "tables_read_all" ON tables FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- ZONE ASSIGNMENTS (staff-to-zone)
-- ============================================
CREATE TABLE IF NOT EXISTS zone_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      uuid REFERENCES profiles(id) ON DELETE CASCADE,
  category_id   uuid REFERENCES table_categories(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE zone_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "zone_assignments_read_all" ON zone_assignments FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    text,
  order_type      text NOT NULL DEFAULT 'dine-in' CHECK (order_type IN ('dine-in','takeaway','delivery','room-service')),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','preparing','completed','paid','cancelled','voided')),
  table_id        uuid REFERENCES tables(id),
  customer_name   text,
  total_amount    numeric(12,2) DEFAULT 0,
  payment_method  text CHECK (payment_method IN ('cash','card','transfer','debt','pos','wave')),
  staff_id        uuid REFERENCES profiles(id),
  notes           text,
  closed_at       timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "orders_read_all" ON orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "orders_insert_all" ON orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "orders_update_all" ON orders FOR UPDATE USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id) WHERE status = 'open';

-- ============================================
-- ORDER ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id    uuid REFERENCES menu_items(id),
  name            text,
  quantity        integer NOT NULL DEFAULT 1,
  unit_price      numeric(12,2) DEFAULT 0,
  total_price     numeric(12,2) DEFAULT 0,
  status          text DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','delivered','cancelled')),
  destination     text DEFAULT 'kitchen' CHECK (destination IN ('kitchen','bar','griller')),
  modifier_notes  text,
  extra_charge    numeric(12,2) DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "order_items_read" ON order_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "order_items_insert" ON order_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "order_items_update" ON order_items FOR UPDATE USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status, destination);

-- ============================================
-- ATTENDANCE
-- ============================================
CREATE TABLE IF NOT EXISTS attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        uuid REFERENCES profiles(id),
  clock_in        timestamptz DEFAULT now(),
  clock_out       timestamptz,
  pos_machine     text,
  till_session    uuid,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "attendance_read" ON attendance FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "attendance_insert" ON attendance FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "attendance_update" ON attendance FOR UPDATE USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_attendance_staff ON attendance(staff_id, clock_in DESC);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS pos_machine text;
CREATE INDEX IF NOT EXISTS idx_attendance_pos_machine ON attendance(pos_machine) WHERE pos_machine IS NOT NULL;

-- ============================================
-- WAITER CALLS
-- ============================================
CREATE TABLE IF NOT EXISTS waiter_calls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id      uuid,
  table_name    text,
  waitron_id    uuid REFERENCES auth.users(id),
  waitron_name  text,
  status        text DEFAULT 'pending' CHECK (status IN ('pending','acknowledged','dismissed')),
  resolved_at   timestamptz,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "waiter_calls_read" ON waiter_calls FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "waiter_calls_insert" ON waiter_calls FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "waiter_calls_update" ON waiter_calls FOR UPDATE TO authenticated USING (true);

-- ============================================
-- VOID LOG
-- ============================================
CREATE TABLE IF NOT EXISTS void_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid REFERENCES orders(id),
  menu_item_name  text,
  quantity        integer,
  unit_price      numeric(12,2),
  total_value     numeric(12,2),
  void_type       text DEFAULT 'item' CHECK (void_type IN ('item','order')),
  reason          text,
  voided_by       uuid REFERENCES auth.users(id),
  voided_by_name  text,
  approved_by     uuid REFERENCES auth.users(id),
  approved_by_name text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE void_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "void_log_read" ON void_log FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "void_log_insert" ON void_log FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- DEBTORS
-- ============================================
CREATE TABLE IF NOT EXISTS debtors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid REFERENCES orders(id),
  customer_name   text NOT NULL,
  phone           text,
  amount          numeric(12,2) NOT NULL DEFAULT 0,
  balance         numeric(12,2) NOT NULL DEFAULT 0,
  status          text DEFAULT 'pending' CHECK (status IN ('pending','partial','paid')),
  staff_id        uuid REFERENCES profiles(id),
  notes           text,
  due_date        date,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE debtors ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "debtors_read" ON debtors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "debtors_insert" ON debtors FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "debtors_update" ON debtors FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================
-- DEBT PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS debt_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_id       uuid REFERENCES debtors(id) ON DELETE CASCADE,
  amount          numeric(12,2) NOT NULL,
  payment_method  text,
  staff_id        uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "debt_payments_read" ON debt_payments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "debt_payments_insert" ON debt_payments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- INVENTORY
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name       text NOT NULL,
  menu_item_id    uuid REFERENCES menu_items(id),
  current_stock   numeric(12,2) DEFAULT 0,
  minimum_stock   numeric(12,2) DEFAULT 0,
  unit            text DEFAULT 'unit',
  cost_price      numeric(12,2),
  supplier_id     uuid,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "inventory_read" ON inventory FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- INVENTORY LOG
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id    uuid REFERENCES inventory(id),
  quantity_change numeric(12,2) NOT NULL,
  reason          text,
  staff_id        uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE inventory_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "inventory_log_read" ON inventory_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "inventory_log_insert" ON inventory_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- SUPPLIERS
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  contact_person  text,
  phone           text,
  email           text,
  address         text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "suppliers_read" ON suppliers FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- PURCHASE ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     uuid REFERENCES suppliers(id),
  item_name       text NOT NULL,
  quantity        numeric(12,2) NOT NULL,
  unit_price      numeric(12,2) DEFAULT 0,
  total_amount    numeric(12,2) DEFAULT 0,
  status          text DEFAULT 'pending' CHECK (status IN ('pending','ordered','received','cancelled')),
  ordered_by      uuid REFERENCES profiles(id),
  received_by     uuid REFERENCES profiles(id),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  received_at     timestamptz
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "purchase_orders_read" ON purchase_orders FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- RESTOCK LOG
-- ============================================
CREATE TABLE IF NOT EXISTS restock_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id    uuid REFERENCES inventory(id),
  quantity        numeric(12,2) NOT NULL,
  unit_price      numeric(12,2),
  supplier_name   text,
  staff_id        uuid REFERENCES profiles(id),
  notes           text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE restock_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "restock_log_read" ON restock_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "restock_log_insert" ON restock_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- KITCHEN STOCK
-- ============================================
CREATE TABLE IF NOT EXISTS kitchen_stock (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id    uuid REFERENCES menu_items(id),
  item_name       text NOT NULL,
  current_qty     numeric(12,2) DEFAULT 0,
  unit            text DEFAULT 'portion',
  updated_at      timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE kitchen_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "kitchen_stock_read" ON kitchen_stock FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- KITCHEN STOCK BENCHMARKS
-- ============================================
CREATE TABLE IF NOT EXISTS kitchen_stock_benchmarks (
  item_name       text PRIMARY KEY,
  expected_yield  numeric(10,2) NOT NULL,
  tolerance_pct   numeric(5,2) NOT NULL DEFAULT 5,
  raw_unit        text NOT NULL DEFAULT 'kg',
  cooked_unit     text NOT NULL DEFAULT 'portion',
  note            text,
  set_by          uuid REFERENCES profiles(id),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE kitchen_stock_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "benchmarks_read" ON kitchen_stock_benchmarks FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "benchmarks_write" ON kitchen_stock_benchmarks FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager'))
);

-- ============================================
-- PAYOUTS
-- ============================================
CREATE TABLE IF NOT EXISTS payouts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        uuid REFERENCES profiles(id),
  amount          numeric(12,2) NOT NULL,
  payout_type     text DEFAULT 'tip' CHECK (payout_type IN ('tip','salary','bonus','advance')),
  approved_by     uuid REFERENCES profiles(id),
  notes           text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "payouts_read" ON payouts FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- ROOMS
-- ============================================
CREATE TABLE IF NOT EXISTS rooms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  room_number     text,
  type            text DEFAULT 'standard' CHECK (type IN ('standard','deluxe','suite','vip')),
  price_per_night numeric(12,2) DEFAULT 0,
  capacity        integer DEFAULT 2,
  status          text DEFAULT 'available' CHECK (status IN ('available','occupied','maintenance','reserved')),
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "rooms_read" ON rooms FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- ROOM STAYS
-- ============================================
CREATE TABLE IF NOT EXISTS room_stays (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid REFERENCES rooms(id),
  guest_name      text NOT NULL,
  guest_phone     text,
  guest_email     text,
  check_in        timestamptz NOT NULL DEFAULT now(),
  check_out       timestamptz,
  num_guests      integer DEFAULT 1,
  rate_per_night  numeric(12,2),
  total_amount    numeric(12,2),
  deposit_paid    numeric(12,2) DEFAULT 0,
  balance         numeric(12,2) DEFAULT 0,
  status          text DEFAULT 'active' CHECK (status IN ('active','checked-out','cancelled')),
  staff_id        uuid REFERENCES profiles(id),
  notes           text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE room_stays ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "room_stays_read" ON room_stays FOR SELECT USING (auth.role() = 'authenticated');
ALTER TABLE room_stays ADD COLUMN IF NOT EXISTS check_in_time text;
ALTER TABLE room_stays ADD COLUMN IF NOT EXISTS guest_id_number text;

-- ============================================
-- SERVICE LOG
-- ============================================
CREATE TABLE IF NOT EXISTS service_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid REFERENCES orders(id),
  table_id        uuid REFERENCES tables(id),
  staff_id        uuid REFERENCES profiles(id),
  action          text NOT NULL,
  details         text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE service_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_log_read" ON service_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "service_log_insert" ON service_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id),
  action          text NOT NULL,
  entity_type     text,
  entity_id       text,
  details         jsonb,
  ip_address      text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "audit_log_insert" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "audit_log_select" ON audit_log FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================
-- PUSH SUBSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id),
  subscription    jsonb NOT NULL,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "push_subscriptions_manage" ON push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- TILL SESSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS till_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        uuid REFERENCES profiles(id),
  pos_machine     text,
  opening_balance numeric(12,2) DEFAULT 0,
  closing_balance numeric(12,2),
  status          text DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_at       timestamptz DEFAULT now(),
  closed_at       timestamptz
);

ALTER TABLE till_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "till_sessions_read" ON till_sessions FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- CV / CCTV TABLES
-- ============================================
CREATE TABLE IF NOT EXISTS cv_people_counts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occupancy     integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cv_people_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "cv_people_read" ON cv_people_counts FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS cv_alerts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id     text NOT NULL,
  alert_type    text NOT NULL,
  severity      text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  description   text,
  resolved      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cv_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "cv_alerts_read" ON cv_alerts FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS cv_zone_heatmaps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_label          text NOT NULL,
  person_count        integer NOT NULL DEFAULT 0,
  avg_dwell_seconds   integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cv_zone_heatmaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "cv_heatmaps_read" ON cv_zone_heatmaps FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS cv_till_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cv_till_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "cv_till_read" ON cv_till_events FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS cv_shelf_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drink_name    text,
  alert_level   text NOT NULL CHECK (alert_level IN ('normal','low','critical','missing')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cv_shelf_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "cv_shelf_read" ON cv_shelf_events FOR SELECT TO authenticated USING (true);

-- CV indexes
CREATE INDEX IF NOT EXISTS idx_cv_people_created   ON cv_people_counts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_alerts_created    ON cv_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_alerts_resolved   ON cv_alerts (resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_heatmaps_created  ON cv_zone_heatmaps (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_till_created      ON cv_till_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_shelf_created     ON cv_shelf_events (created_at DESC);

-- CV realtime
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS cv_people_counts;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS cv_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS cv_zone_heatmaps;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS cv_till_events;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS cv_shelf_events;

-- ============================================
-- DEFAULT SETTINGS
-- ============================================
INSERT INTO settings (id, value) VALUES ('pos_machines', '[]')
ON CONFLICT (id) DO NOTHING;
INSERT INTO settings (id, value) VALUES ('business_name', '"Celebiz"')
ON CONFLICT (id) DO NOTHING;
INSERT INTO settings (id, value) VALUES ('vat_rate', '7.5')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PRINT JOBS (print queue for network receipt printers)
-- ============================================
CREATE TABLE IF NOT EXISTS print_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid REFERENCES orders(id) ON DELETE SET NULL,
  receipt_number  text NOT NULL,
  type            text NOT NULL CHECK (type IN ('customer', 'waiter', 'kitchen', 'bar')),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','printing','printed','failed','cancelled')),
  copies          int DEFAULT 1,
  printer_ip      text,
  receipt_data    jsonb DEFAULT '{}',
  error_message   text,
  retry_count     int DEFAULT 0,
  max_retries     int DEFAULT 5,
  next_retry_at   timestamptz,
  created_at      timestamptz DEFAULT now(),
  started_at      timestamptz,
  printed_at      timestamptz
);

ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "print_jobs_read_all" ON print_jobs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "print_jobs_insert_all" ON print_jobs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "print_jobs_update_own" ON print_jobs FOR UPDATE USING (auth.role() = 'authenticated');

-- Index for retry polling
CREATE INDEX IF NOT EXISTS idx_print_jobs_retry ON print_jobs (status, next_retry_at) WHERE status = 'failed';

-- ============================================
-- PRINTER CONFIGURATION DEFAULTS
-- ============================================
INSERT INTO settings (id, value) VALUES ('printers', jsonb_build_array(
  jsonb_build_object(
    'id', 'cashier',
    'name', 'Cashier Printer',
    'ip', '192.168.1.50',
    'port', 9100,
    'copies', 1,
    'types', jsonb_build_array('customer', 'waiter')
  ),
  jsonb_build_object(
    'id', 'kitchen',
    'name', 'Kitchen Printer',
    'ip', '192.168.1.51',
    'port', 9100,
    'copies', 1,
    'types', jsonb_build_array('kitchen')
  ),
  jsonb_build_object(
    'id', 'bar',
    'name', 'Bar Printer',
    'ip', '192.168.1.52',
    'port', 9100,
    'copies', 1,
    'types', jsonb_build_array('bar')
  )
))
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- MIGRATION: Fix DB schema for mall POS
-- Recreate missing tables, rename columns, drop unused
-- ============================================

-- 1. CREATE MISSING TABLES
-- ============================================

-- Chiller Stock (was bar_chiller_stock)
CREATE TABLE IF NOT EXISTS chiller_stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'bottles',
  opening_qty NUMERIC NOT NULL DEFAULT 0,
  received_qty NUMERIC NOT NULL DEFAULT 0,
  sold_qty NUMERIC NOT NULL DEFAULT 0,
  void_qty NUMERIC NOT NULL DEFAULT 0,
  closing_qty NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  recorded_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chiller_stock_date_item ON chiller_stock(date, item_name);

-- Stock Room (was kitchen_stock)
CREATE TABLE IF NOT EXISTS stock_room (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'portions',
  opening_qty NUMERIC NOT NULL DEFAULT 0,
  received_qty NUMERIC NOT NULL DEFAULT 0,
  sold_qty NUMERIC NOT NULL DEFAULT 0,
  void_qty NUMERIC NOT NULL DEFAULT 0,
  closing_qty NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  recorded_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_room_date_item ON stock_room(date, item_name);

-- Stock Room Benchmarks (was kitchen_stock_benchmarks)
CREATE TABLE IF NOT EXISTS stock_room_benchmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL UNIQUE,
  expected_yield NUMERIC NOT NULL DEFAULT 0,
  tolerance_pct NUMERIC NOT NULL DEFAULT 10,
  raw_qty NUMERIC,
  raw_unit TEXT NOT NULL DEFAULT 'kg',
  cooked_qty NUMERIC,
  cooked_unit TEXT NOT NULL DEFAULT 'portions',
  note TEXT,
  set_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stock Room Entries (was kitchen_stock_entries)
CREATE TABLE IF NOT EXISTS stock_room_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'portions',
  closing_qty NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Void Requests
CREATE TABLE IF NOT EXISTS void_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  station TEXT NOT NULL DEFAULT 'general',
  requested_by UUID REFERENCES profiles(id),
  requested_by_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by_name TEXT
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES profiles(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in TIMESTAMPTZ DEFAULT now(),
  clock_out TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Period Closes
CREATE TABLE IF NOT EXISTS period_closes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_type TEXT NOT NULL DEFAULT 'month',
  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  gross_revenue NUMERIC NOT NULL DEFAULT 0,
  total_voids NUMERIC NOT NULL DEFAULT 0,
  total_payouts NUMERIC NOT NULL DEFAULT 0,
  net_revenue NUMERIC NOT NULL DEFAULT 0,
  cash_revenue NUMERIC NOT NULL DEFAULT 0,
  card_revenue NUMERIC NOT NULL DEFAULT 0,
  transfer_revenue NUMERIC NOT NULL DEFAULT 0,
  credit_revenue NUMERIC NOT NULL DEFAULT 0,
  order_count NUMERIC NOT NULL DEFAULT 0,
  opening_debtors NUMERIC NOT NULL DEFAULT 0,
  closing_debtors NUMERIC NOT NULL DEFAULT 0,
  new_credit_issued NUMERIC NOT NULL DEFAULT 0,
  credit_recovered NUMERIC NOT NULL DEFAULT 0,
  closed_by_name TEXT,
  closed_by UUID REFERENCES profiles(id),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Period Stock Counts
CREATE TABLE IF NOT EXISTS period_stock_counts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_close_id UUID REFERENCES period_closes(id),
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'portions',
  system_qty NUMERIC NOT NULL DEFAULT 0,
  physical_qty NUMERIC,
  variance NUMERIC NOT NULL DEFAULT 0,
  variance_value NUMERIC NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  counted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. RENAME COLUMNS
-- ============================================

ALTER TABLE order_items RENAME COLUMN menu_item_id TO item_id;
ALTER TABLE inventory RENAME COLUMN menu_item_id TO item_id;

-- 3. DROP UNUSED TABLES
-- ============================================

DROP TABLE IF EXISTS customer_addresses;
DROP TABLE IF EXISTS customer_favorites;
DROP TABLE IF EXISTS customer_wallets;
DROP TABLE IF EXISTS wallet_transactions;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS inventory_log;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS rate_limits;
DROP VIEW IF EXISTS profiles_public;

-- 4. RLS POLICIES
-- ============================================

ALTER TABLE chiller_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_room ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_room_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_room_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE void_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_stock_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chiller_stock_auth_all" ON chiller_stock FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "stock_room_auth_all" ON stock_room FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "stock_room_benchmarks_auth_all" ON stock_room_benchmarks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "stock_room_entries_auth_all" ON stock_room_entries FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "void_requests_auth_all" ON void_requests FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "attendance_auth_all" ON attendance FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "period_closes_auth_all" ON period_closes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "period_stock_counts_auth_all" ON period_stock_counts FOR ALL USING (auth.role() = 'authenticated');

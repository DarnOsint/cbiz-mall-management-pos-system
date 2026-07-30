-- ============================================
-- MIGRATION: Mall POS feature expansion
-- New tables for customers, discounts, refunds,
-- shifts, expenses, barcodes, tax, and more
-- ============================================

-- 1. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  loyalty_points INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- 2. CUSTOMER PURCHASES (linked to orders)
CREATE TABLE IF NOT EXISTS customer_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount_spent NUMERIC DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  points_redeemed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. DISCOUNTS / PROMOTIONS
CREATE TABLE IF NOT EXISTS discounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  type TEXT NOT NULL DEFAULT 'percentage',
  value NUMERIC NOT NULL DEFAULT 0,
  min_order_amount NUMERIC DEFAULT 0,
  max_discount_amount NUMERIC,
  applies_to TEXT DEFAULT 'all',
  item_id UUID,
  category_id UUID,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ORDER DISCOUNTS (which discounts applied to which order)
CREATE TABLE IF NOT EXISTS order_discounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  discount_id UUID REFERENCES discounts(id) ON DELETE SET NULL,
  discount_name TEXT,
  discount_type TEXT,
  discount_value NUMERIC DEFAULT 0,
  applied_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TAX CONFIGURATION
CREATE TABLE IF NOT EXISTS tax_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  rate NUMERIC NOT NULL DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add tax_rate_id to items
ALTER TABLE item ADD COLUMN IF NOT EXISTS tax_rate_id UUID REFERENCES tax_rates(id);
ALTER TABLE item ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT true;
ALTER TABLE item ADD COLUMN IF NOT EXISTS barcode TEXT;
CREATE INDEX IF NOT EXISTS idx_item_barcode ON item(barcode);

-- 6. REFUNDS
CREATE TABLE IF NOT EXISTS refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  order_item_id UUID REFERENCES order_items(id),
  customer_id UUID REFERENCES customers(id),
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  refund_amount NUMERIC NOT NULL DEFAULT 0,
  refund_method TEXT NOT NULL DEFAULT 'cash',
  reason TEXT,
  status TEXT DEFAULT 'pending',
  processed_by UUID REFERENCES profiles(id),
  processed_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- 7. SHIFTS / TILL SESSIONS (enhanced)
ALTER TABLE till_sessions ADD COLUMN IF NOT EXISTS opening_cash NUMERIC DEFAULT 0;
ALTER TABLE till_sessions ADD COLUMN IF NOT EXISTS closing_cash NUMERIC DEFAULT 0;
ALTER TABLE till_sessions ADD COLUMN IF NOT EXISTS expected_cash NUMERIC DEFAULT 0;
ALTER TABLE till_sessions ADD COLUMN IF NOT EXISTS cash_variance NUMERIC DEFAULT 0;
ALTER TABLE till_sessions ADD COLUMN IF NOT EXISTS card_total NUMERIC DEFAULT 0;
ALTER TABLE till_sessions ADD COLUMN IF NOT EXISTS mobile_total NUMERIC DEFAULT 0;
ALTER TABLE till_sessions ADD COLUMN IF NOT EXISTS credit_total NUMERIC DEFAULT 0;
ALTER TABLE till_sessions ADD COLUMN IF NOT EXISTS total_sales NUMERIC DEFAULT 0;
ALTER TABLE till_sessions ADD COLUMN IF NOT EXISTS total_refunds NUMERIC DEFAULT 0;
ALTER TABLE till_sessions ADD COLUMN IF NOT EXISTS total_expenses NUMERIC DEFAULT 0;
ALTER TABLE till_sessions ADD COLUMN IF NOT EXISTS notes TEXT;

-- 8. CASH DRAWER MOVEMENTS
CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID REFERENCES till_sessions(id),
  type TEXT NOT NULL DEFAULT 'sale',
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  reference_id UUID,
  performed_by UUID REFERENCES profiles(id),
  performed_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  reference TEXT,
  receipt_url TEXT,
  shift_id UUID REFERENCES till_sessions(id),
  recorded_by UUID REFERENCES profiles(id),
  recorded_by_name TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. RECEIPT SETTINGS (stored in settings table, but add structured fields)
-- Handled via existing settings table with key-value pairs

-- 11. SHOP-TO-SHOP TRANSFERS
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_shop_id UUID,
  to_shop_id UUID,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  transferred_by UUID REFERENCES profiles(id),
  transferred_by_name TEXT,
  received_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  received_at TIMESTAMPTZ
);

-- 12. LOW STOCK ALERTS LOG
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES item(id),
  item_name TEXT NOT NULL,
  current_stock NUMERIC DEFAULT 0,
  threshold NUMERIC DEFAULT 0,
  alert_type TEXT DEFAULT 'low_stock',
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. ITEM BARCODES (alternative barcodes per item)
CREATE TABLE IF NOT EXISTS item_barcodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES item(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL UNIQUE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_item_barcodes_barcode ON item_barcodes(barcode);

-- RLS POLICIES
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_barcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON customer_purchases FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON discounts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON order_discounts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON tax_rates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON refunds FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON cash_movements FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON expenses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON stock_transfers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON stock_alerts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON item_barcodes FOR ALL USING (auth.role() = 'authenticated');

-- DEFAULT TAX RATE (16% VAT South Sudan)
INSERT INTO tax_rates (name, rate, is_default) VALUES ('VAT 16%', 16, true) ON CONFLICT DO NOTHING;

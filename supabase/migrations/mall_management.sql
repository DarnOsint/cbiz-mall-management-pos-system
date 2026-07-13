-- Mall Management — Shops & Rent Tracking
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS mall_floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  floor_number integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mall_floors ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "mall_floors_read_all" ON mall_floors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "mall_floors_write_admin" ON mall_floors FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager'))
);

CREATE TABLE IF NOT EXISTS mall_shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_number text NOT NULL,
  shop_name text NOT NULL,
  floor_id uuid REFERENCES mall_floors(id),
  pos_x integer NOT NULL DEFAULT 0,
  pos_y integer NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 2,
  height integer NOT NULL DEFAULT 2,
  tenant_name text,
  tenant_phone text,
  monthly_rent numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mall_shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "mall_shops_read_all" ON mall_shops FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "mall_shops_write_admin" ON mall_shops FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager'))
);

CREATE TABLE IF NOT EXISTS mall_rent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES mall_shops(id) ON DELETE CASCADE,
  months_paid integer NOT NULL DEFAULT 1,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  paid_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mall_rent_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "mall_rent_payments_read_all" ON mall_rent_payments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "mall_rent_payments_write_admin" ON mall_rent_payments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager'))
);

-- WARNING: This migration references tables/columns dropped by 20260720_restaurant_to_mall_pos.sql.
-- Do NOT run on a clean database after that migration.

-- Boda Boda delivery operators
CREATE TABLE IF NOT EXISTS boda_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  service_area text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add delivery fields to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS boda_operator_id uuid REFERENCES boda_operators(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_area text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status text CHECK (delivery_status IN ('pending_delivery', 'out_for_delivery', 'delivered', 'paid'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee numeric(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_received_at timestamptz;

-- Index for looking up delivery orders
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status) WHERE delivery_status IS NOT NULL;

-- RLS: boda_operators are accessible to authenticated users (same pattern as other tables)
ALTER TABLE boda_operators ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS boda_operators_select ON boda_operators;
DROP POLICY IF EXISTS boda_operators_insert ON boda_operators;
DROP POLICY IF EXISTS boda_operators_update ON boda_operators;
DROP POLICY IF EXISTS boda_operators_delete ON boda_operators;

CREATE POLICY boda_operators_select ON boda_operators FOR SELECT USING (true);
CREATE POLICY boda_operators_insert ON boda_operators FOR INSERT WITH CHECK (true);
CREATE POLICY boda_operators_update ON boda_operators FOR UPDATE USING (true);
CREATE POLICY boda_operators_delete ON boda_operators FOR DELETE USING (true);

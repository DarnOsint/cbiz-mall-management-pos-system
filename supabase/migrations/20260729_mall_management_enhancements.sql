-- Enhance mall_shops with lease dates, deposit, and category
ALTER TABLE mall_shops
  ADD COLUMN IF NOT EXISTS lease_start_date DATE,
  ADD COLUMN IF NOT EXISTS lease_end_date DATE,
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shop_category TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Ensure mall_rent_payments records which user recorded it
ALTER TABLE mall_rent_payments
  ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS recorded_by_name TEXT;

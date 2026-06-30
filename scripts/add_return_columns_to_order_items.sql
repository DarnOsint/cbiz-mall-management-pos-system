ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS return_requested    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_accepted     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_reason       text,
  ADD COLUMN IF NOT EXISTS return_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_accepted_at  timestamptz;

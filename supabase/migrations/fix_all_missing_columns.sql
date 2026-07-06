-- Comprehensive schema alignment: add all columns the code expects
-- that were created directly in Supabase dashboard but never captured in migrations.

-- ============================================
-- 1. ATTENDANCE — add computed/denormalized columns
-- ============================================
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS staff_name text;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS date date;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS duration_minutes integer;

-- ============================================
-- 2. WAITER_CALLS — add tracking columns
-- ============================================
ALTER TABLE waiter_calls ADD COLUMN IF NOT EXISTS called_at timestamptz;
ALTER TABLE waiter_calls ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;
ALTER TABLE waiter_calls ADD COLUMN IF NOT EXISTS acknowledged_by text;

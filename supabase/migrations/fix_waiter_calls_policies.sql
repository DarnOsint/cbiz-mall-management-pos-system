-- WARNING: This migration references tables/columns dropped by 20260720_restaurant_to_mall_pos.sql.
-- Do NOT run on a clean database after that migration.

-- Fix: Add missing RLS policies for waiter_calls

ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'waiter_calls_read' AND tablename = 'waiter_calls') THEN
    CREATE POLICY waiter_calls_read ON waiter_calls FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'waiter_calls_insert' AND tablename = 'waiter_calls') THEN
    CREATE POLICY waiter_calls_insert ON waiter_calls FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'waiter_calls_update' AND tablename = 'waiter_calls') THEN
    CREATE POLICY waiter_calls_update ON waiter_calls FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

INSERT INTO settings (id, value) VALUES ('floor_plan_layout', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

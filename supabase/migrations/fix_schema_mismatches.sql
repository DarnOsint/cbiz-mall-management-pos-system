-- Migration: Fix schema mismatches between code and database
-- Issues fixed:
--   1. audit_log missing columns used by audit.ts and Login.tsx
--   2. order_items missing return_requested/return_accepted columns
--   3. profiles FK to auth.users blocking PIN-only floor staff creation

-- Fix 1: Add missing columns to audit_log
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_name text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS old_value jsonb;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS new_value jsonb;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS performed_by uuid REFERENCES profiles(id);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS performed_by_name text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS performed_by_role text;

-- Fix 2: Add return_requested and return_accepted to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS return_requested boolean DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS return_accepted boolean DEFAULT false;

-- Fix 3: Drop FK from profiles to auth.users (floor staff use PIN-only, no auth user)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Fix 4: Relax role check constraint to allow custom roles from settings
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IS NOT NULL AND role <> '');

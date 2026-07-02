-- Fix missing RLS policies for menu_categories and menu_items
-- Only SELECT policies existed — add INSERT, UPDATE, DELETE for owner/manager roles
-- Run this in Supabase SQL editor

-- Helper to check if current user is owner or manager
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================
-- MENU CATEGORIES — full CRUD for owner/manager
-- ============================================
DROP POLICY IF EXISTS "menu_categories_read_all" ON public.menu_categories;

CREATE POLICY "menu_categories_select"
  ON public.menu_categories FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "menu_categories_insert"
  ON public.menu_categories FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND public.get_user_role() IN ('owner', 'manager')
  );

CREATE POLICY "menu_categories_update"
  ON public.menu_categories FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND public.get_user_role() IN ('owner', 'manager')
  );

CREATE POLICY "menu_categories_delete"
  ON public.menu_categories FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND public.get_user_role() IN ('owner', 'manager')
  );

-- ============================================
-- MENU ITEMS — full CRUD for owner/manager
-- ============================================
DROP POLICY IF EXISTS "menu_items_read_all" ON public.menu_items;

CREATE POLICY "menu_items_select"
  ON public.menu_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "menu_items_insert"
  ON public.menu_items FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND public.get_user_role() IN ('owner', 'manager')
  );

CREATE POLICY "menu_items_update"
  ON public.menu_items FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND public.get_user_role() IN ('owner', 'manager')
  );

CREATE POLICY "menu_items_delete"
  ON public.menu_items FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND public.get_user_role() IN ('owner', 'manager')
  );

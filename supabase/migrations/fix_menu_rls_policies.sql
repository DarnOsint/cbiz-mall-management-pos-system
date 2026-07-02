-- Fix missing RLS policies for menu_categories and menu_items
-- Run this in Supabase SQL editor (Dashboard → SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS

-- ============================================
-- MENU CATEGORIES
-- ============================================
CREATE POLICY IF NOT EXISTS "menu_categories_select" ON public.menu_categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "menu_categories_insert" ON public.menu_categories
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "menu_categories_update" ON public.menu_categories
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "menu_categories_delete" ON public.menu_categories
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- MENU ITEMS
-- ============================================
CREATE POLICY IF NOT EXISTS "menu_items_select" ON public.menu_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "menu_items_insert" ON public.menu_items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "menu_items_update" ON public.menu_items
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "menu_items_delete" ON public.menu_items
  FOR DELETE USING (auth.role() = 'authenticated');

-- Fix missing RLS policies for menu_categories and menu_items
-- Only SELECT policies existed — add INSERT, UPDATE, DELETE for authenticated users
-- Run this in Supabase SQL editor (Dashboard → SQL Editor)

-- ============================================
-- MENU CATEGORIES
-- ============================================
DROP POLICY IF EXISTS "menu_categories_read_all" ON public.menu_categories;

CREATE POLICY "menu_categories_select" ON public.menu_categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "menu_categories_insert" ON public.menu_categories
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "menu_categories_update" ON public.menu_categories
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "menu_categories_delete" ON public.menu_categories
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- MENU ITEMS
-- ============================================
DROP POLICY IF EXISTS "menu_items_read_all" ON public.menu_items;

CREATE POLICY "menu_items_select" ON public.menu_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "menu_items_insert" ON public.menu_items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "menu_items_update" ON public.menu_items
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "menu_items_delete" ON public.menu_items
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- Enable RLS + Passthrough Anon Policies
-- LI Evaluation App — UTeM FTMK (v4.22)
--
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
--
-- What this does:
--   • Enables Row-Level Security on all 4 tables
--   • Adds a permissive "anon_full_access" policy on each table
--     so the anon key retains full read/write access
--   • Does NOT change any application behaviour — real access
--     control remains enforced in the JavaScript query layer
--
-- Safe to re-run: DROP POLICY IF EXISTS makes it idempotent
-- ============================================================

-- Enable RLS
ALTER TABLE public.users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mark_audit ENABLE ROW LEVEL SECURITY;

-- Drop existing passthrough policies (idempotent)
DROP POLICY IF EXISTS "anon_full_access" ON public.users;
DROP POLICY IF EXISTS "anon_full_access" ON public.students;
DROP POLICY IF EXISTS "anon_full_access" ON public.marks;
DROP POLICY IF EXISTS "anon_full_access" ON public.mark_audit;

-- Create passthrough policies
CREATE POLICY "anon_full_access" ON public.users      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON public.students   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON public.marks      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON public.mark_audit FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- LI Evaluation App — Supabase Schema
-- Run this in the Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → paste → Run
-- ============================================================

-- 1. USERS (replaces li_users localStorage)
CREATE TABLE IF NOT EXISTS public.users (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name    TEXT        NOT NULL,
  email        TEXT        UNIQUE NOT NULL,
  password_hash TEXT       NOT NULL,   -- stored as plaintext for now; hash in production
  roles        TEXT[]      NOT NULL DEFAULT '{PENSYARAH}',
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  no_staf      TEXT,
  jabatan      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. STUDENTS
CREATE TABLE IF NOT EXISTS public.students (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL DEFAULT '',
  matric_no    TEXT        UNIQUE NOT NULL,
  kursus       TEXT        DEFAULT '',
  semester     TEXT        DEFAULT '',
  sesi         TEXT        DEFAULT '',
  organisasi   TEXT        DEFAULT '',
  svf_name     TEXT        DEFAULT '',
  svi_name     TEXT        DEFAULT '',
  svf_email    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MARKS
CREATE TABLE IF NOT EXISTS public.marks (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id     UUID        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  evaluator_email TEXT       NOT NULL,
  section        TEXT        NOT NULL,  -- 'svi'|'svf'|'logbook'|'presentation'|'report'|'meta'
  data           JSONB       NOT NULL DEFAULT '{}',
  submitted_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, section)
);

-- ============================================================
-- Row-Level Security: disabled (internal tool, anon key access)
-- Enable and add policies if you need per-user data isolation.
-- ============================================================
ALTER TABLE public.users    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks    DISABLE ROW LEVEL SECURITY;

-- Allow anon role full access (required when RLS is disabled but
-- the table was created with RLS ON previously, or for future-proofing)
GRANT ALL ON public.users    TO anon;
GRANT ALL ON public.students TO anon;
GRANT ALL ON public.marks    TO anon;

-- ============================================================
-- Migration: Run these if upgrading an existing database
-- ============================================================
ALTER TABLE public.users    ADD COLUMN IF NOT EXISTS no_staf  TEXT;
ALTER TABLE public.users    ADD COLUMN IF NOT EXISTS jabatan  TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS svf_email TEXT;

-- v4.1: Change marks unique constraint to allow per-evaluator records
-- (student_id, section) → (student_id, evaluator_email, section)
-- Run in Supabase SQL Editor to apply this migration:
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marks_student_id_section_key'
      AND conrelid = 'public.marks'::regclass
  ) THEN
    ALTER TABLE public.marks DROP CONSTRAINT marks_student_id_section_key;
  END IF;
  -- Add new composite unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marks_student_evaluator_section_key'
      AND conrelid = 'public.marks'::regclass
  ) THEN
    ALTER TABLE public.marks ADD CONSTRAINT marks_student_evaluator_section_key
      UNIQUE (student_id, evaluator_email, section);
  END IF;
END $$;

-- ============================================================
-- Seed default accounts (skip if already exist)
-- ============================================================
INSERT INTO public.users (full_name, email, password_hash, roles, is_active) VALUES
  ('Administrator',        'admin@utem.edu.my',      'admin123',      '{ADMIN}',     TRUE),
  ('AJK Latihan Industri', 'ajkli@utem.edu.my',      'ajkli123',      '{AJK_LI}',   TRUE),
  ('Pensyarah',            'pensyarah@utem.edu.my',  'pensyarah123',  '{PENSYARAH}', TRUE)
ON CONFLICT (email) DO NOTHING;

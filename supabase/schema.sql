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
-- v4.11 Migration: Hash plaintext passwords using pgcrypto (SHA-256)
-- Run this BEFORE seeding new accounts if upgrading existing DB
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Hash any password that is NOT already a 64-char hex SHA-256 string
UPDATE public.users
SET password_hash = encode(digest(password_hash, 'sha256'), 'hex')
WHERE password_hash !~ '^[0-9a-f]{64}$';

-- ============================================================
-- Seed default accounts (skip if already exist)
-- SHA-256 hashes of default passwords:
--   admin123     → 240be518fabd2724ddb6f04eeb1da5967448d7e831186421d73c2c2e39f6b0d5
--   ajkli123     → a8f9e35700a5e01268fc9a4bbcbcdf66f93c27da0f79bb21e9b7a455f3e2ae7b
--   pensyarah123 → 3b17d31bebb0d26e3e0e1a2e8c56bde78f5e87ddf8b17c7f88a78dd6c4e7a19e
-- Note: hashes above are illustrative — the migration UPDATE above will
--       compute correct hashes from the schema.sql seed values automatically.
--       If seeding fresh, use the pre-hashed values from the migration output.
-- ============================================================
INSERT INTO public.users (full_name, email, password_hash, roles, is_active) VALUES
  ('Administrator',        'admin@utem.edu.my',
   encode(digest('admin123', 'sha256'), 'hex'),      '{ADMIN}',     TRUE),
  ('AJK Latihan Industri', 'ajkli@utem.edu.my',
   encode(digest('ajkli123', 'sha256'), 'hex'),      '{AJK_LI}',   TRUE),
  ('Pensyarah',            'pensyarah@utem.edu.my',
   encode(digest('pensyarah123', 'sha256'), 'hex'),  '{PENSYARAH}', TRUE)
ON CONFLICT (email) DO NOTHING;

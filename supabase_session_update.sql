-- ============================================================
-- QNA Copa — Dynamic Session Management Update
-- Run this ENTIRE script in Supabase > SQL Editor
-- ============================================================

-- 1. Create sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,          -- e.g., "2025-2026" or "Batch A"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure only one session can be active at a time using a partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS only_one_active_session 
ON public.sessions (is_active) 
WHERE is_active = true;

-- Disable RLS on sessions for backend admin access
ALTER TABLE public.sessions DISABLE ROW LEVEL SECURITY;

-- 2. Insert a default active session so the system continues to work immediately
INSERT INTO public.sessions (name, start_date, end_date, is_active)
VALUES ('2025-2026', '2025-06-01', '2026-05-31', true)
ON CONFLICT (name) DO NOTHING;

-- 3. Add 'session' column to students table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='session') THEN
        ALTER TABLE public.students ADD COLUMN session TEXT;
    END IF;
END
$$;

-- 4. Update existing students to the default session if they don't have one
UPDATE public.students SET session = '2025-2026' WHERE session IS NULL;

-- 5. Fix older format '2025-26' to '2025-2026' for consistency
UPDATE public.students SET session = '2025-2026' WHERE session = '2025-26';

-- DROP existing tables to prevent conflicts and ensure a fresh setup
DROP TABLE IF EXISTS tests CASCADE;
DROP TABLE IF EXISTS students CASCADE;

-- Create tests table (stores dynamically generated tests and live student tracking data)
CREATE TABLE tests (
  code TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- Create students table (stores registered students for auth and dashboard access)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- Stored as requested by the admin specification
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable Row Level Security since the backend acts as the sole access point using the anon key.
-- Alternatively, if you want to keep RLS enabled, you must create policies. 
ALTER TABLE tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
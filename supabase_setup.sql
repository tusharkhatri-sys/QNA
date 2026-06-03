-- Run this in your Supabase SQL Editor

-- 1. Create the 'tests' table if it doesn't exist
CREATE TABLE IF NOT EXISTS tests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT false,
    update_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create the 'questions' table (if applicable for your QNA project)
CREATE TABLE IF NOT EXISTS questions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    question_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Set up Row Level Security (RLS) Policies
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Allow public read access (Modify based on your auth setup)
CREATE POLICY "Allow public read access on tests" 
ON tests FOR SELECT USING (true);

-- Allow public insert/update (Modify based on your auth setup)
CREATE POLICY "Allow public insert on tests" 
ON tests FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on tests" 
ON tests FOR UPDATE USING (true);

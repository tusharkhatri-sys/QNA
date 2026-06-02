-- ============================================================
-- QNA Copa — Database Fix Migration
-- Run this ENTIRE script in Supabase > SQL Editor
-- ============================================================

-- FIX 1: Create upsert_live_progress RPC
-- Atomically updates liveStudents JSONB inside tests.data
-- to avoid race conditions when multiple students report progress
CREATE OR REPLACE FUNCTION public.upsert_live_progress(
    p_test_code   TEXT,
    p_email_key   TEXT,
    p_student_name TEXT,
    p_student_email TEXT,
    p_answered    INT,
    p_total       INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE tests
    SET data = jsonb_set(
        data,
        '{liveStudents}',
        COALESCE(data->'liveStudents', '{}'::jsonb) || jsonb_build_object(
            p_email_key,
            jsonb_build_object(
                'name',        p_student_name,
                'email',       p_student_email,
                'answered',    p_answered,
                'total',       p_total,
                'updatedAt',   to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            )
        ),
        true
    )
    WHERE code = p_test_code;
END;
$$;


-- FIX 2: Create submit_test_result RPC
-- Atomically appends a student result to tests.data->'students' array
CREATE OR REPLACE FUNCTION public.submit_test_result(
    p_test_code  TEXT,
    p_payload    JSONB,
    p_email_key  TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    existing_students JSONB;
    new_students      JSONB;
BEGIN
    SELECT COALESCE(data->'students', '[]'::jsonb)
    INTO existing_students
    FROM tests
    WHERE code = p_test_code;

    -- Remove old entry for this student if exists, then append new
    SELECT jsonb_agg(el)
    INTO new_students
    FROM jsonb_array_elements(existing_students) el
    WHERE el->>'studentEmail' != p_email_key
      AND el->>'studentName'  != p_email_key;

    new_students := COALESCE(new_students, '[]'::jsonb) || jsonb_build_array(p_payload);

    UPDATE tests
    SET data = jsonb_set(
        data,
        '{students}',
        new_students,
        true
    )
    WHERE code = p_test_code;
END;
$$;


-- Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.upsert_live_progress TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_test_result TO anon, authenticated;

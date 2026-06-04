-- Create allow_retest RPC
CREATE OR REPLACE FUNCTION public.allow_retest(
    p_test_code TEXT,
    p_email_key TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    existing_data JSONB;
    new_live      JSONB;
    new_students  JSONB;
BEGIN
    SELECT data INTO existing_data
    FROM tests
    WHERE code = p_test_code;

    IF existing_data IS NULL THEN
        RETURN;
    END IF;

    -- 1. Remove from liveStudents
    new_live := COALESCE(existing_data->'liveStudents', '{}'::jsonb) - p_email_key;

    -- 2. Remove from students array
    SELECT jsonb_agg(el)
    INTO new_students
    FROM jsonb_array_elements(COALESCE(existing_data->'students', '[]'::jsonb)) el
    WHERE el->>'studentEmail' != p_email_key
      AND el->>'studentName'  != p_email_key;

    -- Update the row
    UPDATE tests
    SET data = jsonb_set(
        jsonb_set(existing_data, '{liveStudents}', new_live, true),
        '{students}',
        COALESCE(new_students, '[]'::jsonb),
        true
    )
    WHERE code = p_test_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.allow_retest TO anon, authenticated;

-- Keep Berojgar Bharat staff out of the DCW employee roster.
--
-- on_profile_created (022) creates a DCW employees row for every new profile.
-- That predates Berojgar Bharat, so every BB account was also landing in DCW's
-- HRMS, attendance grid and payroll — exactly the separation the bb_* tables
-- exist to preserve. BB staff have their own bb_employees row instead.

CREATE OR REPLACE FUNCTION auto_create_employee()
RETURNS TRIGGER AS $$
BEGIN
    -- Berojgar Bharat staff are not DCW employees. They get a bb_employees
    -- row from the BB team screen instead.
    IF NEW.role LIKE 'bb\_%' THEN
        RETURN NEW;
    END IF;

    INSERT INTO employees (profile_id)
    VALUES (NEW.id)
    ON CONFLICT (profile_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove the rows that were already created this way. Scoped to BB profiles
-- that carry no DCW history, so nothing real can be caught by it.
DELETE FROM employees e
USING profiles p
WHERE e.profile_id = p.id
  AND p.role LIKE 'bb\_%'
  AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.employee_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM payroll   r WHERE r.employee_id = e.id);

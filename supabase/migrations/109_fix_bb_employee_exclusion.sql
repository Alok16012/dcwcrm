-- Re-do 107 with a condition that cannot be misread.
--
-- 107 used `NEW.role LIKE 'bb\_%'`. Inside a dollar-quoted function body the
-- backslash survives as LIKE's escape character, which *should* match — but a
-- new bb_telecaller still landed in the DCW employees table afterwards, so the
-- pattern is not worth defending. left() is plain string comparison: no
-- escapes, no wildcards, nothing to get wrong.
--
-- Safe to run whether or not 107 was applied.

CREATE OR REPLACE FUNCTION auto_create_employee()
RETURNS TRIGGER AS $$
BEGIN
    -- Berojgar Bharat staff are not DCW employees. They get a bb_employees
    -- row from the BB team screen instead.
    IF NEW.role IS NOT NULL AND left(NEW.role, 3) = 'bb_' THEN
        RETURN NEW;
    END IF;

    INSERT INTO employees (profile_id)
    VALUES (NEW.id)
    ON CONFLICT (profile_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure the trigger points at the function (harmless if it already does).
DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
AFTER INSERT ON profiles
FOR EACH ROW EXECUTE PROCEDURE auto_create_employee();

-- Clear out any DCW employee rows that belong to BB staff and carry no DCW
-- history of their own.
DELETE FROM employees e
USING profiles p
WHERE e.profile_id = p.id
  AND left(p.role, 3) = 'bb_'
  AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.employee_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM payroll   r WHERE r.employee_id = e.id);

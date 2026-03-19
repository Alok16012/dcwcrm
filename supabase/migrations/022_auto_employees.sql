-- Migration: Auto backfill missing employees for profiles

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Backfill all existing profiles that don't have an employee record yet
    FOR r IN (
        SELECT id FROM profiles
        WHERE id NOT IN (SELECT profile_id FROM employees)
    ) LOOP
        INSERT INTO employees (profile_id)
        VALUES (r.id)
        ON CONFLICT (profile_id) DO NOTHING;
    END LOOP;
END;
$$;

-- Create the trigger function for future inserts
CREATE OR REPLACE FUNCTION auto_create_employee()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create an employee record if it doesn't already exist
    INSERT INTO employees (profile_id)
    VALUES (NEW.id)
    ON CONFLICT (profile_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any (safety measure)
DROP TRIGGER IF EXISTS on_profile_created ON profiles;

-- Create the new trigger to fire right after a User profile is created
CREATE TRIGGER on_profile_created
AFTER INSERT ON profiles
FOR EACH ROW EXECUTE PROCEDURE auto_create_employee();

-- Restructure roles: admin, lead, backend
-- 1. Update existing data
UPDATE profiles SET role = 'lead' WHERE role = 'telecaller';
UPDATE profiles SET role = 'backend' WHERE role = 'finance';

-- 2. Update check constraint on profiles table
-- First, find the name of the existing constraint if possible, but we can also just drop and recreate if we knew the name.
-- Alternatively, we can use a more generic approach:
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'lead', 'backend'));

-- 3. Update existing policies that might explicitly mention old roles (optional, but good for completeness)
-- Most policies use 'admin' which is unchanged.
-- Let's check if any use 'telecaller' or 'finance'.

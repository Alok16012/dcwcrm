-- Add 'student' to the allowed roles in profiles table
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'lead', 'backend', 'housekeeping', 'counselor', 'associate', 'student'));

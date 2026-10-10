-- Staff can sign in with a username as well as their email.
--
-- Stored lower-case and unique. The login form sends anything without an "@"
-- to /api/auth/username-login, which looks the email up here with the service
-- role and signs in server-side — the email behind a username is never
-- returned to the browser.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9._-]{3,30}$');

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON profiles (username);

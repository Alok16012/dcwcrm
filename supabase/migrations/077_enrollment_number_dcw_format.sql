-- Change enrollment number default from ENR- prefix to DCW- prefix
ALTER TABLE students
  ALTER COLUMN enrollment_number
  SET DEFAULT 'DCW-' || floor(random() * 900000 + 100000)::text;

-- Update existing ENR-XXXXXXX or ENR-XXXXXXX(letter) → DCW-XXXXXXX (digits only)
UPDATE students
SET enrollment_number = 'DCW-' || regexp_replace(enrollment_number, '^ENR-([0-9]+).*$', '\1')
WHERE enrollment_number ~* '^ENR-[0-9]';

-- Associate form simplification: the separate current/permanent address blocks
-- are gone from the form, replaced by a single pincode next to state/district/city,
-- plus a passport-size photo that is printed on the application form PDF.
-- Old current_*/permanent_* columns are kept so existing data isn't lost.

ALTER TABLE associates ADD COLUMN IF NOT EXISTS pincode   TEXT;
ALTER TABLE associates ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Carry over the pincode already captured for existing associates
UPDATE associates SET pincode = current_pincode
  WHERE pincode IS NULL AND current_pincode IS NOT NULL AND current_pincode <> '';

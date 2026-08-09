-- Terms text for public lead-capture forms.
--
-- Needed because one live form is served at
-- /f/3-chance-guarantee-else-full-refund while the page itself states no
-- guarantee and no refund conditions anywhere. A paid ad pointing at a
-- URL that promises a refund, on a page that defines none, is both a
-- Google Ads misrepresentation risk and an unfair thing to show a family
-- deciding whether to pay.
--
-- Nullable, so every other form renders exactly as before.

ALTER TABLE lead_capture_forms
  ADD COLUMN IF NOT EXISTS terms text;

COMMENT ON COLUMN lead_capture_forms.terms IS
  'Plain text shown under the form, one condition per line. Required for any form whose offer makes a guarantee or refund promise.';

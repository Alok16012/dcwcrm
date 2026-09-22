-- Resources (prospectus, pamphlets, posters) are browsed department-wise by
-- associates, and admin/backend upload them from the CRM.

ALTER TABLE associate_resources ADD COLUMN IF NOT EXISTS department TEXT;

-- Prospectus and pamphlet were missing from the allowed types
ALTER TABLE associate_resources DROP CONSTRAINT IF EXISTS associate_resources_type_check;
ALTER TABLE associate_resources ADD CONSTRAINT associate_resources_type_check
  CHECK (type IN (
    'prospectus','pamphlet','poster','brochure','fee_structure',
    'admission_form','marketing','reel','training','other'
  ));

CREATE INDEX IF NOT EXISTS idx_assoc_resources_department
  ON associate_resources(department) WHERE department IS NOT NULL;

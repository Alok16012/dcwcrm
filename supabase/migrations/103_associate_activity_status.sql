-- Working status of an approved associate, set by admin/backend from the
-- Associates → Approved tab. Separate from `status` (the pending/approved/
-- rejected application state): an approved associate can be active,
-- inactive (not bringing admissions) or on hold.

ALTER TABLE associates ADD COLUMN IF NOT EXISTS activity_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE associates DROP CONSTRAINT IF EXISTS associates_activity_status_check;
ALTER TABLE associates ADD CONSTRAINT associates_activity_status_check
  CHECK (activity_status IN ('active', 'inactive', 'hold'));

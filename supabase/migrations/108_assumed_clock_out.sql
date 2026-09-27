-- Assumed leaving time when someone forgets to punch out.
--
-- People punch reliably on the way in and forget on the way out, which left
-- those days with no clock-out at all: evaluateDay returned 'missing' and
-- work_minutes stayed null, so the day showed no hours and no verdict.
--
-- This is deliberately NOT office_end. office_end (18:00) is the official end
-- of the working day and drives early-leaving; the assumed punch-out is a
-- separate, later figure the office actually settles on. Keeping them apart
-- means changing one never quietly changes the other.

ALTER TABLE hrms_settings
  ADD COLUMN IF NOT EXISTS assumed_clock_out time NOT NULL DEFAULT '18:30';

COMMENT ON COLUMN hrms_settings.assumed_clock_out IS
  'Clock-out assumed for a finished day where the employee punched in but never out. Never applied to the current day.';

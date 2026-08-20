-- Appointments: counselor/admin bookings against a lead (office visit or
-- Google Meet). Two things this table exists to guarantee:
--   1. A durable audit trail — "kis bacche ka visit kisne kab kiya" should
--      never be ambiguous later. Rows are cancelled, never deleted, by any
--      normal app path (see the DELETE policy below).
--   2. No two people can ever book the same host's same slot. The partial
--      UNIQUE index is the actual fix for this — an app-side "query for
--      conflicts, then insert" has a TOCTOU gap two simultaneous bookers can
--      both slip through; only a DB-level constraint closes it.

CREATE TABLE IF NOT EXISTS appointments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- v1 is scoped tightly to appointments-about-a-lead (the stated pain
  -- point). No ON DELETE CASCADE here, unlike lead_activities — a lead with
  -- appointment history should block a hard delete, not silently drop it.
  lead_id           uuid NOT NULL REFERENCES leads(id),

  appointment_type  text NOT NULL CHECK (appointment_type IN ('office_visit', 'google_meet')),
  meet_link         text,

  host_id           uuid NOT NULL REFERENCES profiles(id),
  created_by        uuid NOT NULL REFERENCES profiles(id),

  scheduled_date    date NOT NULL,
  scheduled_time    time NOT NULL,
  -- Not exposed in the v1 UI (fixed 30-min grid), stored so a future
  -- variable-duration UI doesn't need a schema change.
  duration_minutes  int NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),

  status            text NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),

  notes             text,       -- set at booking time (purpose of visit etc.)
  review_note       text,       -- admin's outcome/review note, set on completion

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT appointments_meet_link_required CHECK (
    appointment_type <> 'google_meet' OR (meet_link IS NOT NULL AND btrim(meet_link) <> '')
  )
);

CREATE INDEX IF NOT EXISTS appointments_lead_id_idx        ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS appointments_scheduled_date_idx ON appointments(scheduled_date);
CREATE INDEX IF NOT EXISTS appointments_host_id_idx        ON appointments(host_id);

-- THE slot lock. Cancelled bookings free the slot; completed/no_show ones
-- (necessarily in the past) don't need to, but leaving them locked is
-- harmless and simpler than reasoning about "is this booked-but-past slot
-- safe to reuse". This is a plain exact-slot lock (host + date + start
-- time) — sufficient because duration is fixed at 30 min via the UI's grid.
-- If variable-length appointments are ever introduced, this needs to become
-- an interval-overlap EXCLUDE USING gist constraint instead.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_host_slot_unique
  ON appointments (host_id, scheduled_date, scheduled_time)
  WHERE status <> 'cancelled';

CREATE OR REPLACE FUNCTION set_appointments_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_updated_at ON appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_appointments_updated_at();

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Read is broad on purpose: the whole counseling team needs to see the slot
-- calendar to avoid double-booking, and admin needs full oversight. This
-- role list must stay in sync with who's allowed to be a host (INSERT
-- policy below) and with lib/appointments/constants.ts's HOST_ROLES.
DROP POLICY IF EXISTS appointments_select ON appointments;
CREATE POLICY appointments_select ON appointments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'lead', 'counselor'))
  );

-- Insert: only counseling staff, only ever attributed to themselves as
-- creator, and only onto a host who is themselves eligible counseling
-- staff — belt-and-braces even though the UI only ever offers valid hosts.
DROP POLICY IF EXISTS appointments_insert ON appointments;
CREATE POLICY appointments_insert ON appointments FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'lead', 'counselor'))
    AND EXISTS (SELECT 1 FROM profiles WHERE id = host_id   AND role IN ('admin', 'lead', 'counselor'))
  );

-- Update: admin always; otherwise only the row's host or its creator — not
-- any random counselor editing someone else's appointment. The finer split
-- (only admin writes the review note / reassigns the host) is a UI-level
-- gate on top of this, the same pattern targets/client.tsx already uses for
-- its admin-only controls — RLS isn't the right layer for column-level
-- permission differences.
DROP POLICY IF EXISTS appointments_update ON appointments;
CREATE POLICY appointments_update ON appointments FOR UPDATE
  USING (
    host_id = auth.uid() OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    host_id = auth.uid() OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Delete: admin-only escape hatch for genuine data-entry mistakes. Not
-- wired to any button in v1 UI — "cancel" is the only product-facing path,
-- this exists so a real mistake can still be cleaned up via direct SQL.
DROP POLICY IF EXISTS appointments_delete ON appointments;
CREATE POLICY appointments_delete ON appointments FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Not consumed by a live subscription in this v1 (the slot picker just
-- refetches on open) — added now so a future live-updating slot browser
-- doesn't need a separate migration, matching how leads/notifications/tasks
-- were already added to this same publication in 093.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
  END IF;
END $$;

-- lead_activities gets three new activity_type values so an appointment
-- being scheduled/completed/cancelled shows inline in the lead's existing
-- timeline, in addition to the appointments table being the real system of
-- record.
ALTER TABLE lead_activities DROP CONSTRAINT IF EXISTS lead_activities_activity_type_check;
ALTER TABLE lead_activities ADD CONSTRAINT lead_activities_activity_type_check
  CHECK (activity_type IN (
    'created', 'status_changed', 'assigned', 'transferred', 'note_added',
    'followup_set', 'payment_received', 'converted', 'document_uploaded',
    'call_made', 'updated',
    'appointment_scheduled', 'appointment_completed', 'appointment_cancelled'
  ));

-- Counselors/leads are the ones actually creating appointments and need to
-- notify the host they picked — 062's original policy only let
-- admin/backend insert notifications, which would silently block that for
-- everyone else. Widen it to the same role list appointments uses.
DROP POLICY IF EXISTS notifications_insert ON notifications;
CREATE POLICY notifications_insert ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend', 'lead', 'counselor'))
  );

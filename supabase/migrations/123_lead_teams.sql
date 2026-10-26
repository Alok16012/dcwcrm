-- Lead distribution teams ("departments" for leads).
--
-- A team owns some forms/campaigns (leads.metadata.form, e.g. a lead-capture
-- form title or 'WhatsApp Chatbot') and/or sources (meta_ads, google_ads, …).
-- A new lead that matches a team is round-robined among that team's members
-- only, so e.g. Open Schooling enquiries reach only the Open Schooling
-- counsellors. Teams are checked in sort_order; the first match wins.
--
-- A lead no team claims goes to the default team, if one is marked;
-- otherwise to every active counsellor, as before teams existed.
-- An IVR call keeps going to the counsellor who took it.

CREATE TABLE IF NOT EXISTS lead_teams (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  -- Optional link to the existing department (Open School, Degree, …): a routed
  -- lead with no department yet gets this one.
  department_id  uuid REFERENCES departments(id) ON DELETE SET NULL,
  member_ids     uuid[] NOT NULL DEFAULT '{}',
  forms          text[] NOT NULL DEFAULT '{}',
  sources        text[] NOT NULL DEFAULT '{}',
  is_default     boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true,
  sort_order     integer NOT NULL DEFAULT 0,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- At most one default team.
CREATE UNIQUE INDEX IF NOT EXISTS lead_teams_one_default ON lead_teams (is_default) WHERE is_default;

ALTER TABLE lead_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_teams_admin_all ON lead_teams;
CREATE POLICY lead_teams_admin_all ON lead_teams FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

CREATE OR REPLACE FUNCTION set_lead_teams_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lead_teams_updated_at ON lead_teams;
CREATE TRIGGER trg_lead_teams_updated_at BEFORE UPDATE ON lead_teams
  FOR EACH ROW EXECUTE FUNCTION set_lead_teams_updated_at();

-- Round-robin inside a team counts the leads it routed today; ingest stamps
-- leads.metadata.lead_team_id, and this index keeps that count cheap.
CREATE INDEX IF NOT EXISTS idx_leads_lead_team ON leads ((metadata->>'lead_team_id'), assigned_at);

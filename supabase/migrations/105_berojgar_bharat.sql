-- Berojgar Bharat — recruitment CRM for a job provider
--
-- A second brand living in the same database as the DCW CRM, in its own bb_*
-- tables. Nothing here touches an existing DCW table: the two businesses share
-- only auth.users and profiles, and even there a person belongs to exactly one
-- side (a bb_* role never sees DCW, a DCW role never sees Berojgar Bharat).
--
-- The money flow this models:
--   candidate (lead) → applies to a job at a company → interviews → joins
--   → placement → commission invoices → payment received
--
-- Commission is per-company by deal, and is *snapshotted onto the placement*
-- so renegotiating a company's rate next year never rewrites last year's
-- revenue.

-- ------------------------------------------------------------- roles ------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    -- DCW
    'admin', 'lead', 'backend', 'housekeeping', 'counselor', 'associate', 'student',
    -- Berojgar Bharat
    'bb_admin', 'bb_manager', 'bb_telecaller'
  ));

/** True when the signed-in user is Berojgar Bharat staff of any level. */
CREATE OR REPLACE FUNCTION is_bb_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('bb_admin', 'bb_manager', 'bb_telecaller')
  );
$$;

/** True for the two BB roles allowed to see money and manage the roster. */
CREATE OR REPLACE FUNCTION is_bb_manager() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('bb_admin', 'bb_manager')
  );
$$;

-- --------------------------------------------------------- companies ------
-- The clients: employers who pay us to fill their openings.
CREATE TABLE IF NOT EXISTS bb_companies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  industry          text,
  website           text,
  gst_number        text,
  address           text,
  city              text,
  state             text,
  contact_person    text,
  contact_phone     text,
  contact_email     text,
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'inactive', 'blacklisted')),

  -- The deal. Either a slice of the candidate's salary, or a flat fee per
  -- hire. A job may override this; a placement freezes whichever applied.
  commission_type   text NOT NULL DEFAULT 'percent_of_salary'
                      CHECK (commission_type IN ('percent_of_salary', 'fixed_per_hire')),
  -- For percent_of_salary:
  commission_percent numeric(6,3),
  -- What the percentage is taken of, and how many times it is billed.
  -- months = 1 with base 'first_month' is the common one-time placement fee;
  -- months = 6 with base 'monthly' is a recurring salary cut.
  commission_base   text DEFAULT 'first_month'
                      CHECK (commission_base IN ('first_month', 'monthly', 'annual')),
  commission_months integer DEFAULT 1 CHECK (commission_months >= 1),
  -- For fixed_per_hire:
  commission_fixed_amount numeric(12,2),

  payment_terms_days integer NOT NULL DEFAULT 30,
  -- Free replacement window: a candidate who leaves inside this many days
  -- must be replaced, so the revenue is at risk until it passes.
  guarantee_days    integer NOT NULL DEFAULT 90,

  notes             text,
  created_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bb_companies_status ON bb_companies (status, name);

-- -------------------------------------------------------------- jobs ------
CREATE TABLE IF NOT EXISTS bb_jobs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES bb_companies(id) ON DELETE CASCADE,
  title             text NOT NULL,
  department        text,
  description       text,
  openings          integer NOT NULL DEFAULT 1 CHECK (openings >= 1),

  salary_min        numeric(12,2),
  salary_max        numeric(12,2),
  salary_period     text NOT NULL DEFAULT 'monthly'
                      CHECK (salary_period IN ('monthly', 'annual')),

  location_city     text,
  location_state    text,
  job_type          text NOT NULL DEFAULT 'full_time'
                      CHECK (job_type IN ('full_time', 'part_time', 'contract', 'internship')),
  experience_min_years numeric(4,1),
  experience_max_years numeric(4,1),
  qualification     text,
  skills            text[],

  status            text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'on_hold', 'closed', 'filled')),

  -- Optional per-job override of the company deal. NULL means "use the
  -- company's terms", which is the usual case.
  commission_type   text CHECK (commission_type IN ('percent_of_salary', 'fixed_per_hire')),
  commission_percent numeric(6,3),
  commission_base   text CHECK (commission_base IN ('first_month', 'monthly', 'annual')),
  commission_months integer CHECK (commission_months >= 1),
  commission_fixed_amount numeric(12,2),

  posted_on         date NOT NULL DEFAULT current_date,
  closes_on         date,
  created_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bb_jobs_company ON bb_jobs (company_id, status);
CREATE INDEX IF NOT EXISTS idx_bb_jobs_open    ON bb_jobs (status, posted_on DESC);

-- -------------------------------------------------------- candidates ------
-- The lead. A job seeker, worked by a telecaller exactly like a DCW lead.
CREATE TABLE IF NOT EXISTS bb_candidates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name         text NOT NULL,
  phone             text NOT NULL,
  alt_phone         text,
  email             text,
  city              text,
  state             text,
  date_of_birth     date,
  gender            text CHECK (gender IN ('male', 'female', 'other')),

  qualification     text,
  experience_years  numeric(4,1),
  current_company   text,
  current_salary    numeric(12,2),
  expected_salary   numeric(12,2),
  notice_period_days integer,
  skills            text[],
  resume_url        text,

  source            text NOT NULL DEFAULT 'other'
                      CHECK (source IN (
                        'website', 'walk_in', 'referral', 'whatsapp', 'phone',
                        'social_media', 'job_portal', 'excel_import', 'other'
                      )),
  status            text NOT NULL DEFAULT 'new'
                      CHECK (status IN (
                        'new', 'contacted', 'interested', 'not_interested',
                        'screening', 'shortlisted', 'interview_scheduled',
                        'selected', 'placed', 'joined', 'dropped', 'blacklisted'
                      )),

  assigned_to       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at       timestamptz,
  next_followup_date date,

  notes             text,
  created_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- One person, one record: the same number ringing twice is the same candidate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bb_candidates_phone ON bb_candidates (phone);
CREATE INDEX IF NOT EXISTS idx_bb_candidates_assigned ON bb_candidates (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_bb_candidates_followup ON bb_candidates (next_followup_date)
  WHERE next_followup_date IS NOT NULL;

-- ------------------------------------------------------ applications ------
-- One candidate can be sent to many jobs; this is the pipeline row.
CREATE TABLE IF NOT EXISTS bb_applications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id      uuid NOT NULL REFERENCES bb_candidates(id) ON DELETE CASCADE,
  job_id            uuid NOT NULL REFERENCES bb_jobs(id) ON DELETE CASCADE,
  company_id        uuid NOT NULL REFERENCES bb_companies(id) ON DELETE CASCADE,

  stage             text NOT NULL DEFAULT 'applied'
                      CHECK (stage IN (
                        'applied', 'screening', 'shortlisted', 'interview',
                        'selected', 'offer_sent', 'joined', 'rejected', 'dropped'
                      )),

  interview_at      timestamptz,
  interview_mode    text CHECK (interview_mode IN ('in_person', 'phone', 'video')),
  interview_notes   text,

  offered_salary    numeric(12,2),
  offer_sent_on     date,
  expected_join_on  date,

  rejected_reason   text,
  created_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Sending the same person to the same opening twice is always a mistake.
  UNIQUE (candidate_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_bb_applications_job   ON bb_applications (job_id, stage);
CREATE INDEX IF NOT EXISTS idx_bb_applications_cand  ON bb_applications (candidate_id);
CREATE INDEX IF NOT EXISTS idx_bb_applications_stage ON bb_applications (stage, created_at DESC);

-- --------------------------------------------------------- placements -----
-- A candidate who actually joined. This is the revenue event.
CREATE TABLE IF NOT EXISTS bb_placements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    uuid NOT NULL UNIQUE REFERENCES bb_applications(id) ON DELETE CASCADE,
  candidate_id      uuid NOT NULL REFERENCES bb_candidates(id) ON DELETE CASCADE,
  job_id            uuid NOT NULL REFERENCES bb_jobs(id) ON DELETE CASCADE,
  company_id        uuid NOT NULL REFERENCES bb_companies(id) ON DELETE CASCADE,

  joined_on         date NOT NULL,
  offered_salary    numeric(12,2) NOT NULL,
  salary_period     text NOT NULL DEFAULT 'monthly'
                      CHECK (salary_period IN ('monthly', 'annual')),

  -- Frozen copy of whichever deal applied at the moment of joining. Changing
  -- the company's terms later must never move money that is already booked.
  commission_type   text NOT NULL
                      CHECK (commission_type IN ('percent_of_salary', 'fixed_per_hire')),
  commission_percent numeric(6,3),
  commission_base   text CHECK (commission_base IN ('first_month', 'monthly', 'annual')),
  commission_months integer NOT NULL DEFAULT 1,
  commission_fixed_amount numeric(12,2),
  total_commission  numeric(12,2) NOT NULL DEFAULT 0,

  guarantee_days    integer NOT NULL DEFAULT 90,
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'left', 'replaced')),
  left_on           date,
  left_reason       text,

  -- Who earned it — the telecaller gets credited off this.
  credited_to       uuid REFERENCES profiles(id) ON DELETE SET NULL,

  notes             text,
  created_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bb_placements_company ON bb_placements (company_id, joined_on DESC);
CREATE INDEX IF NOT EXISTS idx_bb_placements_credit  ON bb_placements (credited_to, joined_on DESC);

-- ------------------------------------------------ commission invoices -----
-- The billing schedule generated from a placement. A one-time fee makes one
-- row; a six-month salary cut makes six, each with its own due date.
CREATE TABLE IF NOT EXISTS bb_commission_invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id      uuid NOT NULL REFERENCES bb_placements(id) ON DELETE CASCADE,
  company_id        uuid NOT NULL REFERENCES bb_companies(id) ON DELETE CASCADE,

  -- 1..commission_months. 1 for a one-time fee.
  instalment_no     integer NOT NULL DEFAULT 1,
  period_start      date,
  period_end        date,

  amount            numeric(12,2) NOT NULL,
  due_date          date NOT NULL,

  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'raised', 'partially_paid', 'paid', 'written_off')),
  invoice_no        text,
  raised_on         date,
  amount_received   numeric(12,2) NOT NULL DEFAULT 0,
  received_on       date,

  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (placement_id, instalment_no)
);

CREATE INDEX IF NOT EXISTS idx_bb_invoices_status  ON bb_commission_invoices (status, due_date);
CREATE INDEX IF NOT EXISTS idx_bb_invoices_company ON bb_commission_invoices (company_id, due_date DESC);

-- --------------------------------------------------------- activities -----
-- Every call, message and stage change on a candidate — the telecaller's log.
CREATE TABLE IF NOT EXISTS bb_activities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id      uuid NOT NULL REFERENCES bb_candidates(id) ON DELETE CASCADE,
  application_id    uuid REFERENCES bb_applications(id) ON DELETE SET NULL,
  activity_type     text NOT NULL
                      CHECK (activity_type IN (
                        'created', 'call', 'whatsapp', 'email', 'note',
                        'status_changed', 'assigned', 'applied', 'stage_changed',
                        'interview_scheduled', 'placed', 'followup_set'
                      )),
  old_value         text,
  new_value         text,
  note              text,
  next_followup_date date,
  performed_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bb_activities_candidate
  ON bb_activities (candidate_id, created_at DESC);

-- --------------------------------------------------------------- RLS ------
ALTER TABLE bb_companies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_jobs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_candidates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_applications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_placements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_commission_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_activities          ENABLE ROW LEVEL SECURITY;

-- Companies and jobs: every BB user needs to read them to know what to pitch;
-- only managers may change them.
DROP POLICY IF EXISTS "BB staff read companies" ON bb_companies;
CREATE POLICY "BB staff read companies" ON bb_companies FOR SELECT USING (is_bb_staff());
DROP POLICY IF EXISTS "BB managers write companies" ON bb_companies;
CREATE POLICY "BB managers write companies" ON bb_companies FOR ALL
  USING (is_bb_manager()) WITH CHECK (is_bb_manager());

DROP POLICY IF EXISTS "BB staff read jobs" ON bb_jobs;
CREATE POLICY "BB staff read jobs" ON bb_jobs FOR SELECT USING (is_bb_staff());
DROP POLICY IF EXISTS "BB managers write jobs" ON bb_jobs;
CREATE POLICY "BB managers write jobs" ON bb_jobs FOR ALL
  USING (is_bb_manager()) WITH CHECK (is_bb_manager());

-- Candidates: a telecaller works their own list; managers see everything.
DROP POLICY IF EXISTS "BB managers manage candidates" ON bb_candidates;
CREATE POLICY "BB managers manage candidates" ON bb_candidates FOR ALL
  USING (is_bb_manager()) WITH CHECK (is_bb_manager());
DROP POLICY IF EXISTS "BB telecaller own candidates" ON bb_candidates;
CREATE POLICY "BB telecaller own candidates" ON bb_candidates FOR ALL
  USING (is_bb_staff() AND (assigned_to = auth.uid() OR created_by = auth.uid()))
  WITH CHECK (is_bb_staff());

DROP POLICY IF EXISTS "BB staff applications" ON bb_applications;
CREATE POLICY "BB staff applications" ON bb_applications FOR ALL
  USING (is_bb_staff()) WITH CHECK (is_bb_staff());

DROP POLICY IF EXISTS "BB staff activities" ON bb_activities;
CREATE POLICY "BB staff activities" ON bb_activities FOR ALL
  USING (is_bb_staff()) WITH CHECK (is_bb_staff());

-- Money: placements are readable by all staff (a telecaller must see their own
-- wins), but only managers may create or change them.
DROP POLICY IF EXISTS "BB staff read placements" ON bb_placements;
CREATE POLICY "BB staff read placements" ON bb_placements FOR SELECT USING (is_bb_staff());
DROP POLICY IF EXISTS "BB managers write placements" ON bb_placements;
CREATE POLICY "BB managers write placements" ON bb_placements FOR ALL
  USING (is_bb_manager()) WITH CHECK (is_bb_manager());

-- Invoices are management-only: what a client is billed is not a telecaller's
-- business.
DROP POLICY IF EXISTS "BB managers invoices" ON bb_commission_invoices;
CREATE POLICY "BB managers invoices" ON bb_commission_invoices FOR ALL
  USING (is_bb_manager()) WITH CHECK (is_bb_manager());

-- ------------------------------------------------------ updated_at --------
CREATE OR REPLACE FUNCTION bb_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bb_companies', 'bb_jobs', 'bb_candidates', 'bb_applications',
    'bb_placements', 'bb_commission_invoices'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION bb_touch_updated_at()',
      t || '_touch', t
    );
  END LOOP;
END $$;

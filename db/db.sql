-- =============================================================================
-- Dependable Care Wellness Centre — Complete Database Schema
-- PostgreSQL 14+  |  HIPAA / OAR 309 / 42 CFR Part 2  |  Multi-tenant (RLS)
--
-- Run once on a fresh database, then run:  npm run db:migrate && npm run db:seed
-- Idempotent: safe to re-run (IF NOT EXISTS / DROP IF EXISTS patterns throughout)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. Schemas
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS ref;
CREATE SCHEMA IF NOT EXISTS care;
CREATE SCHEMA IF NOT EXISTS audit_log;

-- ---------------------------------------------------------------------------
-- 2. Application roles
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE care_app_rw NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE care_app_ro NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 3. ENUMs
-- ---------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE care.legal_status_type AS ENUM
  ('voluntary','guardianship','civil_commitment','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE care.screening_outcome AS ENUM
  ('approved','not_appropriate','deferred_waitlisted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE care.incident_type AS ENUM
  ('accident','medication_error','complaint','behavioral','suspected_abuse_neglect');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE care.drug_disposal_reason AS ENUM
  ('discontinued','expired','unused','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE care.drug_disposal_method AS ENUM
  ('flushed','coffee_grounds','cat_litter','pharmacy_take_back','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE care.shift_type AS ENUM ('day','night','swing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE care.med_route AS ENUM
  ('oral','sublingual','topical','injection','inhalation','transdermal','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE care.evacuation_capability AS ENUM
  ('independent','with_assistance','unable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 4. Shared trigger function  (updated_at)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION care.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END $$;

-- Helper: current tenant UUID from session config (tolerant — returns NULL if unset)
CREATE OR REPLACE FUNCTION care.current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
$$;

-- ---------------------------------------------------------------------------
-- 5. ref  schema
-- ---------------------------------------------------------------------------

-- 5.1  Tenants
CREATE TABLE IF NOT EXISTS ref.tenants (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(200) NOT NULL,
  oregon_npi   VARCHAR(10),
  oar_license  VARCHAR(50),
  timezone     VARCHAR(50)  NOT NULL DEFAULT 'America/Los_Angeles',
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE ref.tenants IS
  'Licensed residential treatment facilities — one row per facility license.';

-- 5.2  Staff
CREATE TABLE IF NOT EXISTS ref.staff (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL REFERENCES ref.tenants(id) ON DELETE RESTRICT,
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  role              TEXT         NOT NULL,
  email             VARCHAR(200) NOT NULL,
  phone             VARCHAR(30),
  license_no        VARCHAR(50),
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  hire_date         DATE,
  termination_date  DATE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, email)
);
COMMENT ON TABLE ref.staff IS
  'Facility employees: counselors, managers, nurses, admins.';

-- 5.3  External organisations (ROI recipients, referral sources)
CREATE TABLE IF NOT EXISTS ref.organizations (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID         NOT NULL REFERENCES ref.tenants(id),
  name        VARCHAR(200) NOT NULL,
  org_type    VARCHAR(50),
  address     TEXT,
  phone       VARCHAR(30),
  fax         VARCHAR(30),
  email       VARCHAR(200),
  npi         VARCHAR(10),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5.4  Staff Certifications
CREATE TABLE IF NOT EXISTS ref.staff_certifications (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id            UUID         NOT NULL REFERENCES ref.staff(id) ON DELETE CASCADE,
  tenant_id           UUID         NOT NULL REFERENCES ref.tenants(id),
  certification_type  VARCHAR(100) NOT NULL,
  certification_name  TEXT,
  certificate_no      TEXT,
  issued_date         DATE,
  expiry_date         DATE,
  verified_date       DATE,
  verified_by         UUID         REFERENCES ref.staff(id),
  notes               TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE ref.staff_certifications IS
  'Staff certifications: CPR, CNA, Med Aide, First Aid, QMHA, Food Handler, etc.';

-- ---------------------------------------------------------------------------
-- 6. care  schema — core tables
-- ---------------------------------------------------------------------------

-- 6.1  Residents  (PHI fields are AES-256-GCM encrypted TEXT in production)
CREATE TABLE IF NOT EXISTS care.residents (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID         NOT NULL REFERENCES ref.tenants(id),
  -- encrypted PHI
  first_name                TEXT,
  last_name                 TEXT,
  preferred_name            TEXT,
  medicaid_id               TEXT,
  ssn_last4                 TEXT,
  phone                     TEXT,
  email                     TEXT,
  address_line1             TEXT,
  -- non-encrypted demographics
  pronoun                   VARCHAR(30),
  gender                    VARCHAR(50),
  date_of_birth             DATE,
  preferred_contact_method  VARCHAR(50),
  address_line2             TEXT,
  city                      VARCHAR(100),
  state                     VARCHAR(50)   NOT NULL DEFAULT 'Oregon',
  postal_code               VARCHAR(20),
  country                   VARCHAR(50)   NOT NULL DEFAULT 'USA',
  language_preference        VARCHAR(50),
  tribal_affiliation         TEXT,
  spiritual_religious        TEXT,
  other_cultural_factors     TEXT,
  -- clinical
  primary_diagnosis          TEXT,
  secondary_diagnoses        TEXT[],
  substance_use_flag         BOOLEAN      NOT NULL DEFAULT FALSE,
  legal_risk_flag            BOOLEAN      NOT NULL DEFAULT FALSE,
  -- intake / discharge
  intake_date                DATE,
  discharge_date             DATE,
  target_discharge_date      DATE,
  housing_type_preferred     TEXT,
  income_source_needed       TEXT,
  aftercare_providers        TEXT,
  age_at_admission           SMALLINT,
  -- consents
  consent_to_treatment       VARCHAR(20)  NOT NULL DEFAULT 'pending'
                               CHECK (consent_to_treatment IN ('pending','signed','declined')),
  consent_date               DATE,
  rights_notification_date   DATE,
  grievance_procedure_date   DATE,
  has_advance_directive      VARCHAR(10)  NOT NULL DEFAULT 'no'
                               CHECK (has_advance_directive IN ('yes','no','unknown')),
  has_guardian               BOOLEAN      NOT NULL DEFAULT FALSE,
  guardian_representative    TEXT,
  -- status / audit
  status                     VARCHAR(30)  NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','discharged','inactive','on_leave')),
  created_by                 UUID         REFERENCES ref.staff(id),
  updated_by                 UUID         REFERENCES ref.staff(id),
  deleted_at                 TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  version                    INTEGER      NOT NULL DEFAULT 1
);
COMMENT ON TABLE care.residents IS
  'Core resident record. PHI encrypted at rest. Soft-delete only (HIPAA retention).';

-- 6.2  Legal representatives / emergency contacts
CREATE TABLE IF NOT EXISTS care.representatives (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id           UUID         NOT NULL REFERENCES care.residents(id) ON DELETE CASCADE,
  tenant_id             UUID         NOT NULL REFERENCES ref.tenants(id),
  first_name            VARCHAR(100) NOT NULL,
  last_name             VARCHAR(100) NOT NULL,
  relation_to_resident  VARCHAR(100),
  primary_phone         VARCHAR(30),
  alternate_phone       VARCHAR(30),
  email                 VARCHAR(200),
  is_primary            BOOLEAN      NOT NULL DEFAULT FALSE,
  is_emergency_contact  BOOLEAN      NOT NULL DEFAULT FALSE,
  has_legal_authority   BOOLEAN      NOT NULL DEFAULT FALSE,
  legal_authority_type  VARCHAR(100),
  notes                 TEXT,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6.3  User accounts  (application login)
CREATE TABLE IF NOT EXISTS care.user_accounts (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID         NOT NULL REFERENCES ref.tenants(id),
  staff_id             UUID         REFERENCES ref.staff(id) ON DELETE RESTRICT,
  resident_id          UUID         REFERENCES care.residents(id) ON DELETE SET NULL,
  email                VARCHAR(200) NOT NULL UNIQUE,
  password_hash        TEXT         NOT NULL,
  username             VARCHAR(200),
  role                 TEXT         NOT NULL
                         CHECK (role IN ('resident_care_of','staff','manager','admin','superadmin')),
  is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
  failed_attempts      SMALLINT     NOT NULL DEFAULT 0,
  locked_until         TIMESTAMPTZ,
  last_login           TIMESTAMPTZ,
  password_changed_required BOOLEAN NOT NULL DEFAULT FALSE,
  password_changed_at  TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE care.user_accounts IS
  'Application auth — one login per staff member or care-of resident.';

-- 6.4  Care plans
CREATE TABLE IF NOT EXISTS care.care_plans (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES ref.tenants(id),
  resident_id           UUID        NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  plan_type             VARCHAR(50) NOT NULL DEFAULT 'initial'
                          CHECK (plan_type IN ('initial','annual','quarterly','discharge','transition')),
  status                VARCHAR(30) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','active','superseded','discharged','expired')),
  effective_date        DATE,
  expiration_date       DATE,
  review_date           DATE,
  review_schedule       VARCHAR(50),
  primary_counselor_id  UUID        REFERENCES ref.staff(id),
  program_director_id   UUID        REFERENCES ref.staff(id),
  counselor_signed_at   TIMESTAMPTZ,
  director_signed_at    TIMESTAMPTZ,
  client_signed_at      TIMESTAMPTZ,
  client_sig_status     VARCHAR(30),
  created_by            UUID        REFERENCES ref.staff(id),
  updated_by            UUID        REFERENCES ref.staff(id),
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  version               INTEGER     NOT NULL DEFAULT 1
);
COMMENT ON TABLE care.care_plans IS
  'OAR 309 treatment plan. Optimistic locking via version. Superseded on new plan creation.';

-- 6.5  Domain assessments
CREATE TABLE IF NOT EXISTS care.domain_assessments (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id     UUID         NOT NULL REFERENCES care.care_plans(id) ON DELETE CASCADE,
  tenant_id        UUID         NOT NULL REFERENCES ref.tenants(id),
  domain           VARCHAR(100) NOT NULL,
  assessment_text  TEXT,
  strengths        TEXT,
  barriers         TEXT,
  priority_level   VARCHAR(20)  NOT NULL DEFAULT 'medium'
                     CHECK (priority_level IN ('low','medium','high','critical')),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6.6  Goals
CREATE TABLE IF NOT EXISTS care.goals (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id  UUID        NOT NULL REFERENCES care.care_plans(id) ON DELETE CASCADE,
  tenant_id     UUID        NOT NULL REFERENCES ref.tenants(id),
  section       VARCHAR(100),
  goal_number   INTEGER,
  goal_text     TEXT        NOT NULL,
  status        VARCHAR(30) NOT NULL DEFAULT 'not_started'
                  CHECK (status IN ('not_started','in_progress','achieved','discontinued')),
  domain        VARCHAR(100),
  target_date   DATE,
  achieved_date DATE,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6.7  Objectives
CREATE TABLE IF NOT EXISTS care.objectives (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id               UUID        NOT NULL REFERENCES care.goals(id) ON DELETE CASCADE,
  tenant_id             UUID        NOT NULL REFERENCES ref.tenants(id),
  objective_number      INTEGER,
  objective_text        TEXT        NOT NULL,
  intervention          TEXT,
  frequency             VARCHAR(100),
  responsible_party     VARCHAR(100),
  responsible_staff_id  UUID        REFERENCES ref.staff(id),
  status                VARCHAR(30) NOT NULL DEFAULT 'not_started'
                          CHECK (status IN ('not_started','in_progress','met','unmet')),
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6.8  Progress notes  (goal-based; immutable once signed)
CREATE TABLE IF NOT EXISTS care.progress_notes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id  UUID        NOT NULL REFERENCES care.objectives(id) ON DELETE CASCADE,
  tenant_id     UUID        NOT NULL REFERENCES ref.tenants(id),
  note_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  note_text     TEXT        NOT NULL,
  authored_by   UUID        REFERENCES ref.staff(id),
  signed_at     TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE care.progress_notes IS
  'Goal-objective progress notes. Once signed_at is set, trigger prevents any further modification.';

-- 6.9  Safety plans  (one-per-care-plan)
CREATE TABLE IF NOT EXISTS care.safety_plans (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id              UUID        NOT NULL UNIQUE REFERENCES care.care_plans(id) ON DELETE CASCADE,
  tenant_id                 UUID        NOT NULL REFERENCES ref.tenants(id),
  crisis_plan               TEXT,
  crisis_resources          TEXT,
  suicide_risk_level        VARCHAR(20) CHECK (suicide_risk_level IN ('none','low','moderate','high','imminent')),
  suicide_risk_protocol     TEXT,
  self_harm_risk_level      VARCHAR(20) CHECK (self_harm_risk_level IN ('none','low','moderate','high')),
  self_harm_protocol        TEXT,
  aggression_risk_level     VARCHAR(20) CHECK (aggression_risk_level IN ('none','low','moderate','high')),
  aggression_protocol       TEXT,
  awol_risk_level           VARCHAR(20) CHECK (awol_risk_level IN ('none','low','moderate','high')),
  awol_prevention           TEXT,
  contraband_policy         TEXT,
  mandatory_reporting       TEXT,
  de_escalation_techniques  TEXT,
  last_reviewed_at          TIMESTAMPTZ,
  reviewed_by               UUID        REFERENCES ref.staff(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6.10  Daily living needs  (one-per-care-plan)
CREATE TABLE IF NOT EXISTS care.daily_living_needs (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id           UUID        NOT NULL UNIQUE REFERENCES care.care_plans(id) ON DELETE CASCADE,
  tenant_id              UUID        NOT NULL REFERENCES ref.tenants(id),
  hygiene_support        TEXT,
  nutrition_support      TEXT,
  medication_management  TEXT,
  mobility_assistance    TEXT,
  transportation_needs   TEXT,
  financial_management   TEXT,
  household_tasks        TEXT,
  communication_needs    TEXT,
  employment_education   TEXT,
  social_activities      TEXT,
  leisure_activities     TEXT,
  sleep_schedule         TEXT,
  special_dietary_needs  TEXT,
  assistive_devices      TEXT,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6.11  Discharge plans
CREATE TABLE IF NOT EXISTS care.discharge_plans (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id                UUID REFERENCES care.care_plans(id) ON DELETE SET NULL,
  resident_id                 UUID NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  tenant_id                   UUID NOT NULL REFERENCES ref.tenants(id),
  discharge_type              VARCHAR(50),
  planned_discharge_date      DATE,
  actual_discharge_date       DATE,
  discharge_destination       TEXT,
  housing_plan                TEXT,
  employment_plan             TEXT,
  support_network             TEXT,
  follow_up_appointments      TEXT,
  referrals                   TEXT,
  transportation_plan         TEXT,
  medication_plan             TEXT,
  crisis_plan_post_discharge  TEXT,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6.12  Legal advocacy
CREATE TABLE IF NOT EXISTS care.legal_advocacy (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id             UUID NOT NULL REFERENCES care.care_plans(id) ON DELETE CASCADE,
  tenant_id                UUID NOT NULL REFERENCES ref.tenants(id),
  legal_status             TEXT,
  court_dates              TEXT,
  legal_obligations        TEXT,
  probation_parole_officer TEXT,
  po_contact               TEXT,
  case_manager             TEXT,
  legal_aid_provider       TEXT,
  pending_charges          TEXT,
  restraining_orders       TEXT,
  dcs_involvement          BOOLEAN NOT NULL DEFAULT FALSE,
  dcs_caseworker           TEXT,
  advocacy_notes           TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6.13  Care team members
CREATE TABLE IF NOT EXISTS care.care_team_members (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id  UUID         NOT NULL REFERENCES care.residents(id) ON DELETE CASCADE,
  tenant_id    UUID         NOT NULL REFERENCES ref.tenants(id),
  staff_id     UUID         REFERENCES ref.staff(id),
  role         VARCHAR(100) NOT NULL,
  is_primary   BOOLEAN      NOT NULL DEFAULT FALSE,
  start_date   DATE,
  end_date     DATE,
  notes        TEXT,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6.14  Release of Information (ROI)  — 42 CFR Part 2
CREATE TABLE IF NOT EXISTS care.roi_records (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id       UUID         NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  tenant_id         UUID         NOT NULL REFERENCES ref.tenants(id),
  recipient_name    VARCHAR(200) NOT NULL,
  recipient_type    VARCHAR(50),
  recipient_org     UUID         REFERENCES ref.organizations(id),
  information_scope TEXT,
  signed_date       DATE,
  effective_date    DATE,
  expiration_date   DATE,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  revoked_at        TIMESTAMPTZ,
  revoked_by        UUID         REFERENCES ref.staff(id),
  revocation_reason TEXT,
  created_by        UUID         REFERENCES ref.staff(id),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE care.roi_records IS
  '42 CFR Part 2 consent to disclose. Soft-revoked, never deleted.';

-- 6.15  Notifications
CREATE TABLE IF NOT EXISTS care.notifications (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES ref.tenants(id),
  user_id               UUID        REFERENCES care.user_accounts(id) ON DELETE CASCADE,
  role_filter           TEXT,
  type                  VARCHAR(50) NOT NULL,
  category              VARCHAR(50),
  title                 TEXT        NOT NULL,
  body                  TEXT,
  action_url            TEXT,
  is_read               BOOLEAN     NOT NULL DEFAULT FALSE,
  read_at               TIMESTAMPTZ,
  dismissed_at          TIMESTAMPTZ,
  resident_id           UUID        REFERENCES care.residents(id) ON DELETE SET NULL,
  reference_id          UUID,
  document_id           UUID,
  related_admission_id  UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE care.notifications IS
  'System and clinical notifications. user_id targets a specific user; role_filter broadcasts to a role (NULL = all).
   document_id and related_admission_id link notifications to admission form PDFs.';

-- 6.16  Cultural Identity (per care plan)
CREATE TABLE IF NOT EXISTS care.care_plan_cultural_identity (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id             UUID        NOT NULL UNIQUE REFERENCES care.care_plans(id) ON DELETE CASCADE,
  tenant_id                UUID        NOT NULL REFERENCES ref.tenants(id),
  tribal_affiliation       TEXT,
  primary_language         TEXT,
  interpreter_needed       BOOLEAN     NOT NULL DEFAULT FALSE,
  spiritual_religious      TEXT,
  gender_identity          TEXT,
  sexual_orientation       TEXT,
  cultural_considerations  TEXT,
  dietary_restrictions     TEXT,
  important_cultural_dates TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6.17  Care Plan Signatures
CREATE TABLE IF NOT EXISTS care.care_plan_signatures (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id     UUID        NOT NULL REFERENCES care.care_plans(id) ON DELETE CASCADE,
  tenant_id        UUID        NOT NULL REFERENCES ref.tenants(id),
  signatory_type   VARCHAR(50) NOT NULL
                     CHECK (signatory_type IN ('client','guardian','counselor','director','nurse','supervisor','other')),
  signatory_name   TEXT,
  staff_id         UUID        REFERENCES ref.staff(id),
  signed_at        TIMESTAMPTZ,
  signature_method VARCHAR(30) NOT NULL DEFAULT 'in_person',
  ip_address       TEXT,
  declined         BOOLEAN     NOT NULL DEFAULT FALSE,
  decline_reason   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6.18  Resident Requests
CREATE TABLE IF NOT EXISTS care.resident_requests (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id    UUID         NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  tenant_id      UUID         NOT NULL REFERENCES ref.tenants(id),
  request_type   VARCHAR(100) NOT NULL,
  details        TEXT,
  submitted_date DATE         NOT NULL DEFAULT CURRENT_DATE,
  status         VARCHAR(30)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','in_review','approved','denied','completed')),
  response_notes TEXT,
  completed_date DATE,
  handled_by     UUID         REFERENCES ref.staff(id),
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE care.resident_requests IS
  'Resident portal requests (room changes, additional services, complaints, etc.).';

-- ---------------------------------------------------------------------------
-- 7. care  schema — admission & clinical operations forms
-- ---------------------------------------------------------------------------

-- 7.1  Pre-Admission Screening
CREATE TABLE IF NOT EXISTS care.pre_admission_screenings (
  id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                           UUID NOT NULL REFERENCES ref.tenants(id),
  resident_id                         UUID REFERENCES care.residents(id) ON DELETE SET NULL,
  referring_agency                    TEXT,
  referral_date                       DATE,
  contact_person                      TEXT,
  contact_phone                       TEXT,
  contact_email                       TEXT,
  client_full_name                    TEXT,
  date_of_birth                       DATE,
  age                                 SMALLINT,
  preferred_pronouns                  TEXT,
  ssn                                 TEXT,
  ohp_id                              TEXT,
  other_insurance                     TEXT,
  other_insurance_id                  TEXT,
  current_living_situation            TEXT,
  county_of_residence                 TEXT,
  presenting_problem                  TEXT,
  primary_dsm5_diagnosis              TEXT,
  primary_diagnosis_date              DATE,
  secondary_diagnoses                 TEXT,
  psychotropic_medications            JSONB,
  psych_hospitalization_hx            BOOLEAN DEFAULT FALSE,
  psych_hospitalization_recent_date   DATE,
  psych_hospitalization_reason        TEXT,
  suicide_self_harm_hx                BOOLEAN DEFAULT FALSE,
  suicide_self_harm_details           TEXT,
  violence_aggression_hx              BOOLEAN DEFAULT FALSE,
  violence_aggression_details         TEXT,
  outpatient_therapist                TEXT,
  outpatient_therapist_phone          TEXT,
  outpatient_psychiatrist             TEXT,
  outpatient_psychiatrist_phone       TEXT,
  outpatient_case_manager             TEXT,
  outpatient_case_manager_phone       TEXT,
  pcp_name                            TEXT,
  pcp_phone                           TEXT,
  pcp_fax                             TEXT,
  medical_diagnoses                   TEXT,
  non_psych_medications               JSONB,
  allergies                           TEXT,
  mobility_independent                BOOLEAN DEFAULT TRUE,
  mobility_assistive_device           TEXT,
  mobility_wheelchair                 BOOLEAN DEFAULT FALSE,
  adl_needs                           TEXT[],
  adl_bathing_detail                  TEXT,
  adl_dressing_detail                 TEXT,
  adl_medication_detail               TEXT,
  tb_test_result                      TEXT,
  tb_test_date                        DATE,
  covid_vaccination_status            TEXT,
  other_communicable_disease          TEXT,
  primary_substance                   TEXT,
  secondary_substances                TEXT,
  last_use_date                       DATE,
  withdrawal_hx                       BOOLEAN DEFAULT FALSE,
  withdrawal_details                  TEXT,
  previous_treatment_episodes         TEXT,
  income_source                       TEXT,
  legal_status                        TEXT,
  probation_parole_officer            TEXT,
  probation_officer_phone             TEXT,
  trauma_history                      BOOLEAN DEFAULT FALSE,
  willing_to_discuss_trauma           BOOLEAN,
  strengths_interests                 TEXT,
  needs_24hr_supervision              BOOLEAN DEFAULT FALSE,
  needs_medication_mgmt               BOOLEAN DEFAULT FALSE,
  needs_adl_assistance                BOOLEAN DEFAULT FALSE,
  needs_dementia_care                 BOOLEAN DEFAULT FALSE,
  needs_cbt_dbt_groups                BOOLEAN DEFAULT FALSE,
  needs_sud_programming               BOOLEAN DEFAULT FALSE,
  needs_wheelchair_accessible         BOOLEAN DEFAULT FALSE,
  needs_secure_facility               BOOLEAN DEFAULT FALSE,
  needs_specialized_diet              BOOLEAN DEFAULT FALSE,
  needs_other                         TEXT,
  assessed_for_abh_home               TEXT,
  lmha_connected                      BOOLEAN,
  lmha_agency_name                    TEXT,
  lmha_contact                        TEXT,
  waitlist_other_services             TEXT,
  client_strengths_summary            TEXT,
  barriers_to_placement               TEXT,
  assessor_recommendation             TEXT,
  screening_outcome                   care.screening_outcome,
  conditions_prior_admission          TEXT,
  completed_by_name                   TEXT,
  completed_by_staff_id               UUID REFERENCES ref.staff(id),
  reviewed_by_name                    TEXT,
  reviewed_by_staff_id                UUID REFERENCES ref.staff(id),
  completed_at                        TIMESTAMPTZ,
  reviewed_at                         TIMESTAMPTZ,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                          TIMESTAMPTZ,
  version                             INT NOT NULL DEFAULT 1
);
COMMENT ON TABLE care.pre_admission_screenings IS
  'Pre-Admission Screening Form — 9 sections. Created before resident is admitted.';

-- 7.2  Initial Screening Assessment
CREATE TABLE IF NOT EXISTS care.initial_screenings (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       UUID NOT NULL REFERENCES ref.tenants(id),
  resident_id                     UUID REFERENCES care.residents(id) ON DELETE SET NULL,
  pre_admission_screening_id      UUID REFERENCES care.pre_admission_screenings(id),
  resident_name                   TEXT,
  screening_date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  date_of_birth                   DATE,
  age_at_screening                SMALLINT,
  anticipated_admission_date      DATE,
  referral_source_agency          TEXT,
  case_manager_name               TEXT,
  case_manager_phone_email        TEXT,
  legal_status                    care.legal_status_type,
  legal_representative            TEXT,
  reason_for_referral             TEXT,
  mh_diagnosis_status             TEXT,
  diagnosis_description           TEXT,
  meets_rth_level_of_care         TEXT,
  current_living_situation        TEXT,
  previous_placements             TEXT,
  mh_services_past_12mo           TEXT,
  health_screening_by             TEXT,
  health_screening_date           DATE,
  medical_conditions              TEXT,
  current_medications             TEXT,
  allergies                       TEXT,
  tb_screening_completed          BOOLEAN DEFAULT FALSE,
  no_known_communicable_diseases  BOOLEAN DEFAULT FALSE,
  communicable_followup_needed    BOOLEAN DEFAULT FALSE,
  communicable_followup_notes     TEXT,
  pcp_name                        TEXT,
  mobility                        TEXT,
  mobility_device                 TEXT,
  adl_level                       TEXT,
  communication_type              TEXT,
  communication_device            TEXT,
  evacuation_ability              care.evacuation_capability,
  evacuation_notes                TEXT,
  safety_risks                    TEXT[],
  safety_risks_other              TEXT,
  recent_behavioral_concerns      TEXT,
  recent_hospitalizations         BOOLEAN DEFAULT FALSE,
  recent_hospitalizations_details TEXT,
  triggers_support_strategies     TEXT,
  rth_can_meet_needs              BOOLEAN,
  rth_accommodations_needed       TEXT,
  admission_wont_impact_residents BOOLEAN,
  services_required               TEXT[],
  resident_goals_preferences      TEXT,
  resident_strengths              TEXT,
  resident_family_concerns        TEXT,
  screening_outcome               care.screening_outcome,
  conditions_prior_admission      TEXT,
  deferred_reason                 TEXT,
  screened_by_name                TEXT,
  screened_by_title               TEXT,
  screened_by_staff_id            UUID REFERENCES ref.staff(id),
  screened_at                     TIMESTAMPTZ,
  reviewed_by_name                TEXT,
  reviewed_by_title               TEXT,
  reviewed_by_staff_id            UUID REFERENCES ref.staff(id),
  reviewed_at                     TIMESTAMPTZ,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                      TIMESTAMPTZ,
  version                         INT NOT NULL DEFAULT 1
);
COMMENT ON TABLE care.initial_screenings IS
  'Initial Screening Assessment — 12-section RTH eligibility review.';

-- 7.3  Advance Directives
CREATE TABLE IF NOT EXISTS care.advance_directives (
  id                               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                        UUID NOT NULL REFERENCES ref.tenants(id),
  resident_id                      UUID NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  purpose_acknowledged             BOOLEAN DEFAULT FALSE,
  health_care_agent_name           TEXT,
  health_care_agent_relationship   TEXT,
  health_care_agent_phone          TEXT,
  consents_psych_medications       BOOLEAN,
  psych_med_notes                  TEXT,
  consents_hospitalization         BOOLEAN,
  preferred_treatment_facility     TEXT,
  consents_emergency_interventions BOOLEAN,
  consents_seclusion_restraint     BOOLEAN,
  emergency_intervention_notes     TEXT,
  prefers_individual_therapy       BOOLEAN DEFAULT FALSE,
  prefers_group_therapy            BOOLEAN DEFAULT FALSE,
  prefers_specific_therapy_type    TEXT,
  therapies_to_avoid               TEXT,
  medications_to_avoid             TEXT,
  prefers_non_medication_first     BOOLEAN DEFAULT FALSE,
  wants_spiritual_care             BOOLEAN,
  spiritual_care_notes             TEXT,
  wants_cultural_mindfulness       BOOLEAN DEFAULT TRUE,
  cultural_considerations          TEXT,
  has_end_of_life_instructions     BOOLEAN DEFAULT FALSE,
  end_of_life_description          TEXT,
  resident_signed_at               TIMESTAMPTZ,
  witness1_name                    TEXT,
  witness1_signed_at               TIMESTAMPTZ,
  witness2_name                    TEXT,
  witness2_signed_at               TIMESTAMPTZ,
  health_care_agent_signed_at      TIMESTAMPTZ,
  last_reviewed_date               DATE,
  next_review_date                 DATE,
  agency_phone                     TEXT,
  staff_director_contact           TEXT,
  emergency_services_contact       TEXT,
  is_active                        BOOLEAN NOT NULL DEFAULT TRUE,
  superseded_by                    UUID REFERENCES care.advance_directives(id),
  created_by                       UUID REFERENCES ref.staff(id),
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                       TIMESTAMPTZ,
  version                          INT NOT NULL DEFAULT 1
);

-- 7.4  Resident Face Sheet
CREATE TABLE IF NOT EXISTS care.resident_face_sheets (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES ref.tenants(id),
  resident_id                 UUID NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  admit_date                  DATE,
  aka                         TEXT,
  birth_gender                TEXT,
  self_identified_gender      TEXT,
  ethnicity                   TEXT,
  marital_status              TEXT,
  religious_preference        TEXT,
  insurance                   TEXT,
  insurance_id                TEXT,
  housing                     TEXT,
  burial_plan_on_file         BOOLEAN DEFAULT FALSE,
  mh_declaration_on_file      BOOLEAN DEFAULT FALSE,
  advance_directive_on_file   BOOLEAN DEFAULT FALSE,
  pharmacy                    TEXT,
  legal_status                care.legal_status_type,
  evacuation_capability       care.evacuation_capability,
  service_coordinator         TEXT,
  prescriber                  TEXT,
  emergency_contact_relation  TEXT,
  emergency_contact_address   TEXT,
  emergency_contact_phone     TEXT,
  guardian_name               TEXT,
  guardian_phone              TEXT,
  income_source               TEXT,
  payee                       TEXT,
  primary_diagnosis           TEXT,
  locus_score                 TEXT,
  lsi_score                   TEXT,
  health_concerns             TEXT,
  allergies                   JSONB,
  pcp                         JSONB,
  emergency_medical           JSONB,
  dental                      JSONB,
  emergency_dental            JSONB,
  photo_url                   TEXT,
  photo_public_id             TEXT,
  photo_uploaded_at           TIMESTAMPTZ,
  photo_metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_updated_by             UUID REFERENCES ref.staff(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (resident_id)
);
COMMENT ON TABLE care.resident_face_sheets IS
  'Quick-reference card. One per resident.';

-- 7.5  Resident Specific Plan  (4 domains, 24 sub-domains)
CREATE TABLE IF NOT EXISTS care.resident_specific_plans (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES ref.tenants(id),
  resident_id                 UUID NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  care_plan_id                UUID REFERENCES care.care_plans(id) ON DELETE SET NULL,
  plan_date                   DATE NOT NULL DEFAULT CURRENT_DATE,
  administrator_name          TEXT,
  review_date_6mo             DATE,
  psychiatric_diagnosis       TEXT,
  medical_diagnosis           TEXT,
  hx_of                       TEXT,
  smoker                      BOOLEAN,
  has_dentures                BOOLEAN,
  has_glasses                 BOOLEAN,
  has_contacts                BOOLEAN,
  has_hearing_aid             BOOLEAN,
  can_read                    BOOLEAN,
  can_write                   BOOLEAN,
  dominant_hand               TEXT,
  main_language               TEXT,
  second_language             TEXT,
  medication_allergies        TEXT,
  food_allergies              TEXT,
  diabetic                    BOOLEAN DEFAULT FALSE,
  last_flu_shot               DATE,
  last_eye_exam               DATE,
  last_tb_test                DATE,
  last_dental_exam            DATE,
  last_prostate_exam          DATE,
  last_mammogram              DATE,
  last_pap                    DATE,
  crisis_plan_domain          TEXT,
  goals_while_living          TEXT,
  areas_needing_help          TEXT,
  what_helps_bad_days         TEXT,
  strengths                   TEXT,
  additional_concerns         TEXT,
  -- Domain 1: ADL Tasks
  d1_hygiene_individual_does       TEXT, d1_hygiene_staff_services      TEXT, d1_hygiene_frequency         TEXT,
  d1_grooming_level                TEXT, d1_grooming_frequency           TEXT,
  d1_bathing_level                 TEXT, d1_bathing_frequency            TEXT,
  d1_dressing_level                TEXT, d1_dressing_time_required       TEXT,
  d1_restrictions                  TEXT, d1_assistance_needed_with       TEXT,
  d1_skin_concerns                 TEXT, d1_hygiene_goal                 TEXT, d1_safety_concerns           TEXT,
  d1_med_self_manage               TEXT, d1_med_self_admin_order         TEXT, d1_med_delegations           TEXT,
  d1_adaptive_device               TEXT, d1_catheter                     BOOLEAN DEFAULT FALSE,
  d1_pcp_order_on_file             BOOLEAN, d1_on_mar                    BOOLEAN,
  d1_food_allergies                TEXT, d1_general_appetite             TEXT,
  d1_eating_concerns               TEXT, d1_diet_restrictions            TEXT, d1_food_preferences          TEXT,
  d1_ambulation_assistance         TEXT, d1_ambulation_assistance_detail TEXT, d1_ambulation_equipment      TEXT,
  d1_community_assistance          TEXT, d1_attendant_instructions       TEXT,
  d1_toilet_assistance             TEXT, d1_toilet_equipment             TEXT,
  d1_bladder_control               TEXT, d1_bowel_control                TEXT, d1_post_toilet_hygiene       TEXT,
  d1_catheter_assist               TEXT, d1_delegations_detail           TEXT,
  d1_delegated_task                TEXT, d1_delegations_performed_by     TEXT, d1_rn_delegation_order       TEXT,
  -- Domain 2: IADL Tasks
  d2_finances_managed_by           TEXT, d2_financial_overseer           TEXT, d2_finances_edu_training     TEXT,
  d2_meal_food_allergies           TEXT, d2_meal_edu_training            TEXT,
  d2_meal_special_accommodations   TEXT, d2_kitchen_safety_concerns      TEXT,
  d2_cleaning_edu_training         TEXT, d2_cleaning_supplies            TEXT, d2_cleaning_safety_concerns  TEXT,
  d2_transport_independent         TEXT, d2_transport_provided_by        TEXT,
  d2_transport_edu_training        TEXT, d2_transport_safety_concerns    TEXT,
  d2_appt_staff_assistance         TEXT, d2_appt_edu_training            TEXT, d2_appt_concerns             TEXT,
  d2_legal_status                  TEXT, d2_legal_conditions             TEXT, d2_substance_hx              TEXT,
  d2_most_recent_usage             TEXT, d2_legal_concerns               TEXT,
  d2_social_staff_assistance       TEXT, d2_social_edu_training          TEXT,
  d2_places_hobbies                TEXT, d2_family_peer_support          TEXT, d2_social_concerns           TEXT,
  -- Domain 3: Psychosocial Rehabilitation
  d3_physical_risk_self            TEXT, d3_physical_risk_self_signs     TEXT, d3_physical_risk_self_training TEXT,
  d3_physical_risk_self_crisis_plan TEXT, d3_physical_risk_self_tactics  TEXT, d3_physical_risk_self_goals  TEXT,
  d3_physical_risk_others          TEXT, d3_physical_risk_others_signs   TEXT,
  d3_physical_risk_others_training TEXT, d3_physical_risk_others_tactics TEXT, d3_physical_risk_others_goals TEXT,
  d3_impulse_exhibits              TEXT, d3_impulse_management           TEXT,
  d3_impulse_training              TEXT, d3_impulse_tactics              TEXT, d3_impulse_goals             TEXT,
  d3_delusion_exhibits             TEXT, d3_delusion_management          TEXT,
  d3_delusion_training             TEXT, d3_delusion_tactics             TEXT, d3_delusion_goals            TEXT,
  d3_emotional_exhibits            TEXT, d3_emotional_management         TEXT,
  d3_emotional_training            TEXT, d3_emotional_triggers           TEXT,
  d3_emotional_tactics             TEXT, d3_emotional_goals              TEXT,
  d3_communicates_effectively      TEXT, d3_comm_device_needed           TEXT,
  d3_comm_reading_writing          TEXT, d3_comm_signs                   TEXT,
  d3_comm_training                 TEXT, d3_comm_goals                   TEXT, d3_comm_concerns             TEXT,
  d3_comorbid_exists               TEXT, d3_comorbid_conditions          TEXT,
  d3_comorbid_training             TEXT, d3_comorbid_concerns            TEXT,
  -- Domain 4: Person-Centred Services & Supports
  d4_emergency_exiting             TEXT, d4_equipment_needed             TEXT,
  d4_physical_assist               TEXT, d4_verbal_cuing                 TEXT,
  d4_los_supervision_needed        TEXT, d4_los_reasons                  TEXT, d4_los_where                 TEXT,
  d4_los_training                  TEXT, d4_los_safety_goals             TEXT,
  d4_1to1_needed                   TEXT, d4_1to1_reason                  TEXT,
  d4_1to1_training                 TEXT, d4_1to1_safety_goals            TEXT,
  signatures                       JSONB,
  created_by                       UUID REFERENCES ref.staff(id),
  updated_by                       UUID REFERENCES ref.staff(id),
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                       TIMESTAMPTZ,
  version                          INT NOT NULL DEFAULT 1
);
COMMENT ON TABLE care.resident_specific_plans IS
  'Resident Specific Plan — 4 domains, 24 sub-domains. Person-centred care detail.';

-- 7.6  Medications
CREATE TABLE IF NOT EXISTS care.medications (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES ref.tenants(id),
  resident_id              UUID NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  drug_name                TEXT        NOT NULL,
  drug_strength            TEXT,
  drug_form                TEXT,
  route                    care.med_route DEFAULT 'oral',
  dosage                   TEXT,
  frequency                TEXT,
  prescriber               TEXT,
  prescriber_phone         TEXT,
  pharmacy                 TEXT,
  rx_number                TEXT,
  indication               TEXT,
  start_date               DATE,
  end_date                 DATE,
  is_controlled_substance  BOOLEAN     NOT NULL DEFAULT FALSE,
  is_prn                   BOOLEAN     NOT NULL DEFAULT FALSE,
  prn_instructions         TEXT,
  special_instructions     TEXT,
  is_active                BOOLEAN     NOT NULL DEFAULT TRUE,
  discontinued_reason      TEXT,
  discontinued_at          DATE,
  created_by               UUID REFERENCES ref.staff(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7.7  Daily Progress Notes  (shift-based)
CREATE TABLE IF NOT EXISTS care.daily_progress_notes_v2 (
  id                               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                        UUID NOT NULL REFERENCES ref.tenants(id),
  resident_id                      UUID NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  care_plan_id                     UUID REFERENCES care.care_plans(id) ON DELETE SET NULL,
  note_date                        DATE NOT NULL DEFAULT CURRENT_DATE,
  shift                            care.shift_type NOT NULL,
  authored_by                      UUID REFERENCES ref.staff(id),
  observed_mood                    TEXT[],
  observed_mood_notes              TEXT,
  observed_affect                  TEXT[],
  observed_affect_notes            TEXT,
  appearance                       TEXT[],
  appearance_notes                 TEXT,
  programming_participation        TEXT,
  peer_staff_interactions          TEXT[],
  notable_behaviors                TEXT,
  mse_speech                       TEXT, mse_speech_notes              TEXT,
  mse_thought_process              TEXT, mse_thought_process_notes     TEXT,
  mse_thought_content              TEXT, mse_perceptions               TEXT,
  mse_insight_judgment             TEXT,
  sleep_report                     TEXT,
  nutrition_hydration              TEXT,
  personal_hygiene                 TEXT,
  medications_taken_as_prescribed  BOOLEAN DEFAULT TRUE,
  medication_refused               BOOLEAN DEFAULT FALSE,
  medication_refused_detail        TEXT,
  side_effects_noted               TEXT,
  is_diabetic                      BOOLEAN DEFAULT FALSE,
  glucose_breakfast                SMALLINT, glucose_lunch SMALLINT, glucose_dinner SMALLINT,
  groups_attended                  TEXT,
  group_participation_level        TEXT,
  group_response                   TEXT,
  treatment_plan_goal_addressed    TEXT,
  staff_interventions              TEXT,
  no_incidents                     BOOLEAN DEFAULT TRUE,
  incident_report_completed        BOOLEAN DEFAULT FALSE,
  incident_details                 TEXT,
  contacts                         TEXT,
  staff_to_staff_notes             TEXT,
  clinical_summary                 TEXT,
  rn_comments                      TEXT,
  next_steps                       TEXT,
  signed_at                        TIMESTAMPTZ,
  signed_by                        UUID REFERENCES ref.staff(id),
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                       TIMESTAMPTZ,
  version                          INT NOT NULL DEFAULT 1
);
COMMENT ON TABLE care.daily_progress_notes_v2 IS
  'Daily Progress Notes — 10-section shift-based documentation.';

-- 7.8  Medication Administrations  (MAR)
CREATE TABLE IF NOT EXISTS care.medication_administrations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES ref.tenants(id),
  medication_id       UUID NOT NULL REFERENCES care.medications(id) ON DELETE RESTRICT,
  resident_id         UUID NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  daily_note_id       UUID REFERENCES care.daily_progress_notes_v2(id),
  administered_at     TIMESTAMPTZ NOT NULL,
  shift               care.shift_type,
  administered_by     UUID REFERENCES ref.staff(id),
  dose_given          TEXT,
  route_used          care.med_route,
  was_refused         BOOLEAN DEFAULT FALSE,
  refusal_reason      TEXT,
  side_effects_noted  TEXT,
  prn_reason          TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7.9  Blood Glucose Readings
CREATE TABLE IF NOT EXISTS care.blood_glucose_readings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES ref.tenants(id),
  resident_id   UUID NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  daily_note_id UUID REFERENCES care.daily_progress_notes_v2(id),
  reading_time  TIMESTAMPTZ NOT NULL,
  meal_context  TEXT,
  glucose_value SMALLINT,
  units         TEXT DEFAULT 'mg/dL',
  recorded_by   UUID REFERENCES ref.staff(id),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7.10  Incident Reports  (APD 0344)
CREATE TABLE IF NOT EXISTS care.incident_reports (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    UUID NOT NULL REFERENCES ref.tenants(id),
  resident_id                  UUID NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  incident_date                DATE NOT NULL,
  incident_time                TIME NOT NULL,
  incident_type                care.incident_type NOT NULL,
  abuse_reported_to_office_date DATE,
  incident_location            TEXT,
  other_residents_involved     TEXT,
  was_witnessed                BOOLEAN DEFAULT FALSE,
  witnessed_by                 TEXT,
  body_areas_injured           JSONB,
  incident_details             TEXT NOT NULL,
  staff_actions_taken          TEXT NOT NULL,
  follow_up_plan               TEXT,
  completed_by_name            TEXT,
  completed_by_staff_id        UUID REFERENCES ref.staff(id),
  completed_at                 TIMESTAMPTZ,
  licensee_signature           TEXT,
  date_of_review               DATE,
  date_signed                  DATE,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                   TIMESTAMPTZ,
  version                      INT NOT NULL DEFAULT 1
);
COMMENT ON TABLE care.incident_reports IS
  'Incident Report Form APD 0344.';

CREATE TABLE IF NOT EXISTS care.incident_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES care.incident_reports(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES ref.tenants(id),
  notified_party  TEXT NOT NULL,
  was_notified    BOOLEAN NOT NULL DEFAULT FALSE,
  contact_name    TEXT,
  notified_date   DATE,
  notified_time   TIME
);

-- 7.11  Evacuation Drills  (OAR 411-050-0725)
CREATE TABLE IF NOT EXISTS care.evacuation_drills (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES ref.tenants(id),
  afh_licensee_name           TEXT,
  afh_address                 TEXT,
  drill_date                  DATE NOT NULL,
  drill_time                  TIME NOT NULL,
  has_sprinklers              BOOLEAN DEFAULT FALSE,
  drill_type                  TEXT,
  last_sleeping_hours_drill   DATE,
  minimum_staff_required      SMALLINT,
  simulated_fire_location     TEXT,
  exit_route                  TEXT,
  time_to_initial_safety_secs INT,
  time_to_final_safety_secs   INT,
  staff_conducting_drill      TEXT,
  staff_conducting_signature  TEXT,
  created_by                  UUID REFERENCES ref.staff(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS care.evacuation_drill_participants (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id                  UUID NOT NULL REFERENCES care.evacuation_drills(id) ON DELETE CASCADE,
  tenant_id                 UUID NOT NULL REFERENCES ref.tenants(id),
  participant_type          TEXT NOT NULL,
  resident_id               UUID REFERENCES care.residents(id),
  participant_name          TEXT,
  individual_evac_time_secs INT,
  substitute_required       BOOLEAN DEFAULT FALSE,
  assistance_description    TEXT,
  used_as_substitute        BOOLEAN DEFAULT FALSE,
  role_during_drill         TEXT
);

-- 7.12  Drug Disposal Records  (OAR 411-050-0655)
CREATE TABLE IF NOT EXISTS care.drug_disposal_records (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES ref.tenants(id),
  resident_id             UUID NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  medication_id           UUID REFERENCES care.medications(id),
  disposal_date           DATE NOT NULL,
  drug_name               TEXT NOT NULL,
  drug_strength           TEXT,
  quantity_disposed       NUMERIC(10,2),
  quantity_unit           TEXT,
  disposal_reason         care.drug_disposal_reason NOT NULL,
  disposal_reason_other   TEXT,
  disposal_method         care.drug_disposal_method NOT NULL,
  disposal_method_other   TEXT,
  counting_staff_name     TEXT NOT NULL,
  counting_staff_id       UUID REFERENCES ref.staff(id),
  witness_name            TEXT,
  witness_staff_id        UUID REFERENCES ref.staff(id),
  is_controlled_substance BOOLEAN DEFAULT FALSE,
  hipaa_label_removed     BOOLEAN DEFAULT FALSE,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE care.drug_disposal_records IS
  'Drug Disposal Record — OAR 411-050-0655. Retained 3 years after resident departure.';

-- 7.13  Staff Time Records
CREATE TABLE IF NOT EXISTS care.staff_time_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES ref.tenants(id),
  staff_id         UUID NOT NULL REFERENCES ref.staff(id),
  clock_in         TIMESTAMPTZ NOT NULL,
  clock_out        TIMESTAMPTZ,
  shift            care.shift_type,
  location         TEXT,
  break_minutes    SMALLINT DEFAULT 0,
  notes            TEXT,
  late_clock_in    BOOLEAN DEFAULT FALSE,
  early_clock_out  BOOLEAN DEFAULT FALSE,
  manager_override BOOLEAN DEFAULT FALSE,
  override_by      UUID REFERENCES ref.staff(id),
  override_reason  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_clock_times CHECK (clock_out IS NULL OR clock_out > clock_in)
);
COMMENT ON TABLE care.staff_time_records IS
  'Staff clock-in/clock-out. Used for shift compliance and labour reporting.';

-- 7.14  Incident Injury Zones  (body diagram — many per incident)
CREATE TABLE IF NOT EXISTS care.incident_injury_zones (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  UUID        NOT NULL REFERENCES care.incident_reports(id) ON DELETE CASCADE,
  tenant_id    UUID        NOT NULL REFERENCES ref.tenants(id),
  zone_code    VARCHAR(30) NOT NULL,
  zone_label   TEXT,
  injury_type  TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE care.incident_injury_zones IS
  'Body diagram injury zones. zone_code: head, face, neck, chest, abdomen, back, left_arm, right_arm, left_hand, right_hand, left_leg, right_leg, left_foot, right_foot, genitals, buttocks, other.';

-- 7.15  Nursing Admissions  (8-step clinical admission wizard)
CREATE TABLE IF NOT EXISTS care.nursing_admissions (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID        NOT NULL REFERENCES ref.tenants(id),
  resident_id               UUID        NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  admission_date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  -- Step 1: Admission Info
  admitted_from             TEXT,
  admission_type            TEXT,
  admitting_nurse           TEXT,
  admitting_nurse_id        UUID        REFERENCES ref.staff(id),
  admitting_physician       TEXT,
  -- Step 2: Vitals
  height_cm                 NUMERIC(5,1),
  weight_kg                 NUMERIC(6,2),
  bmi                       NUMERIC(4,1),
  bp_systolic               SMALLINT,
  bp_diastolic              SMALLINT,
  pulse                     SMALLINT,
  respirations              SMALLINT,
  temperature_c             NUMERIC(4,1),
  o2_saturation             NUMERIC(5,2),
  pain_level                SMALLINT    CHECK (pain_level BETWEEN 0 AND 10),
  glucose                   SMALLINT,
  -- Step 3: Medical History & Allergies
  known_allergies           JSONB,
  medical_history           TEXT,
  surgical_history          TEXT,
  family_history            TEXT,
  immunizations_up_to_date  BOOLEAN,
  last_physical_exam        DATE,
  -- Step 4: Medications Review
  medications_reviewed      BOOLEAN     NOT NULL DEFAULT FALSE,
  medications_reviewed_by   UUID        REFERENCES ref.staff(id),
  medications_reviewed_at   TIMESTAMPTZ,
  -- Step 5: Systems Review
  cardiovascular_notes      TEXT,
  respiratory_notes         TEXT,
  gastrointestinal_notes    TEXT,
  genitourinary_notes       TEXT,
  musculoskeletal_notes     TEXT,
  neurological_notes        TEXT,
  skin_notes                TEXT,
  endocrine_notes           TEXT,
  -- Step 6: ADL / Functional Assessment
  adl_bathing               TEXT,
  adl_dressing              TEXT,
  adl_grooming              TEXT,
  adl_eating                TEXT,
  adl_mobility              TEXT,
  adl_toileting             TEXT,
  fall_risk_score           SMALLINT,
  fall_risk_level           TEXT,
  pressure_ulcer_risk       TEXT,
  -- Step 7: Psychosocial (see care.mental_status_exams for structured MSE)
  psychosocial_notes        TEXT,
  -- Step 8: Nursing Plan / Disposition
  nursing_care_plan         TEXT,
  physician_orders          TEXT,
  disposition               TEXT,
  follow_up_required        BOOLEAN     NOT NULL DEFAULT FALSE,
  follow_up_notes           TEXT,
  completed_at              TIMESTAMPTZ,
  completed_by              UUID        REFERENCES ref.staff(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                TIMESTAMPTZ,
  version                   INT         NOT NULL DEFAULT 1
);
COMMENT ON TABLE care.nursing_admissions IS
  '8-step nursing admission assessment. Distinct from pre_admission_screenings (clinical only, post-admission).';

-- 7.16  Mental Status Examinations
CREATE TABLE IF NOT EXISTS care.mental_status_exams (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID        NOT NULL REFERENCES ref.tenants(id),
  resident_id            UUID        NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  nursing_admission_id   UUID        REFERENCES care.nursing_admissions(id) ON DELETE SET NULL,
  daily_note_id          UUID        REFERENCES care.daily_progress_notes_v2(id) ON DELETE SET NULL,
  exam_date              DATE        NOT NULL DEFAULT CURRENT_DATE,
  level_of_consciousness TEXT,
  orientation            TEXT[],
  attention              TEXT,
  appearance             TEXT,
  behavior               TEXT,
  psychomotor            TEXT,
  speech_rate            TEXT,
  speech_volume          TEXT,
  speech_quality         TEXT,
  mood                   TEXT,
  affect                 TEXT,
  thought_process        TEXT,
  thought_content        TEXT,
  hallucinations         BOOLEAN     NOT NULL DEFAULT FALSE,
  hallucination_type     TEXT,
  hallucination_detail   TEXT,
  delusions              BOOLEAN     NOT NULL DEFAULT FALSE,
  delusion_detail        TEXT,
  cognitive_function     TEXT,
  insight                TEXT,
  judgment               TEXT,
  impulse_control        TEXT,
  suicidal_ideation      BOOLEAN     NOT NULL DEFAULT FALSE,
  homicidal_ideation     BOOLEAN     NOT NULL DEFAULT FALSE,
  overall_impression     TEXT,
  examiner_id            UUID        REFERENCES ref.staff(id),
  examiner_name          TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE care.mental_status_exams IS
  'Structured MSE — linked to nursing admission or daily progress note.';

-- 7.17  Suicide Risk Assessments  (Columbia Protocol / C-SSRS)
CREATE TABLE IF NOT EXISTS care.suicide_risk_assessments (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID        NOT NULL REFERENCES ref.tenants(id),
  resident_id              UUID        NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  nursing_admission_id     UUID        REFERENCES care.nursing_admissions(id) ON DELETE SET NULL,
  assessment_date          DATE        NOT NULL DEFAULT CURRENT_DATE,
  -- C-SSRS Ideation Scale (ascending severity)
  wish_to_be_dead          BOOLEAN,
  suicidal_ideation        BOOLEAN,
  ideation_with_plan       BOOLEAN,
  intent_to_act            BOOLEAN,
  intent_with_plan         BOOLEAN,
  -- C-SSRS Behavior Scale
  preparatory_behavior     BOOLEAN,
  aborted_attempt          BOOLEAN,
  interrupted_attempt      BOOLEAN,
  actual_attempt           BOOLEAN,
  attempt_count            SMALLINT,
  most_recent_attempt_date DATE,
  -- Risk & Protective Factors
  risk_factors             TEXT[],
  protective_factors       TEXT[],
  -- Clinical Determination
  overall_risk_level       VARCHAR(20) NOT NULL DEFAULT 'low'
                             CHECK (overall_risk_level IN ('none','low','moderate','high','imminent')),
  observation_level        VARCHAR(50),
  recommended_actions      TEXT,
  assessor_id              UUID        REFERENCES ref.staff(id),
  assessor_name            TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE care.suicide_risk_assessments IS
  'Columbia Suicide Severity Rating Scale (C-SSRS). Linked to nursing admission or standalone.';

-- ---------------------------------------------------------------------------
-- 8. audit_log  schema  — HIPAA § 164.312(b) — write-once
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log.event_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID,
  event_time    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_id      UUID,
  actor_ip      TEXT,
  actor_role    TEXT,
  event_type    TEXT        NOT NULL,
  table_name    TEXT,
  record_id     UUID,
  resident_id   UUID,
  old_values    JSONB,
  new_values    JSONB,
  diff_keys     TEXT[],
  session_id    TEXT,
  request_id    TEXT,
  phi_accessed  BOOLEAN     NOT NULL DEFAULT TRUE,
  justification TEXT
);
COMMENT ON TABLE audit_log.event_log IS
  'Immutable HIPAA audit trail. No UPDATE/DELETE permitted to any role.';

CREATE TABLE IF NOT EXISTS audit_log.credential_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES ref.tenants(id),
  user_account_id     UUID NOT NULL REFERENCES care.user_accounts(id) ON DELETE CASCADE,
  staff_id            UUID REFERENCES ref.staff(id),
  resident_id         UUID REFERENCES care.residents(id),
  credential_type     VARCHAR(50) NOT NULL CHECK (credential_type IN ('staff', 'resident', 'reset')),
  username            VARCHAR(200),
  password_hash       TEXT NOT NULL,
  was_temporary       BOOLEAN NOT NULL DEFAULT TRUE,
  generated_by        UUID REFERENCES ref.staff(id),
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  first_login_at      TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  reason              VARCHAR(255),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE RULE no_update_audit AS ON UPDATE TO audit_log.event_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_audit AS ON DELETE TO audit_log.event_log DO INSTEAD NOTHING;

-- Stub PHI-event trigger function (app writes audit via AuditLogger, not this trigger)
CREATE OR REPLACE FUNCTION audit_log.log_phi_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 9. Trigger functions specific to care tables
-- ---------------------------------------------------------------------------

-- Immutability: signed progress notes cannot be modified
CREATE OR REPLACE FUNCTION care.lock_signed_progress_note()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.signed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Signed progress notes are immutable. Create an addendum instead.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 10. Attach triggers  (idempotent via existence check)
-- ---------------------------------------------------------------------------
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ref.tenants','ref.staff','ref.staff_certifications',
    'care.residents','care.representatives','care.user_accounts',
    'care.care_plans','care.domain_assessments',
    'care.goals','care.objectives','care.progress_notes',
    'care.safety_plans','care.daily_living_needs','care.discharge_plans',
    'care.legal_advocacy','care.care_team_members','care.roi_records',
    'care.care_plan_cultural_identity','care.care_plan_signatures','care.resident_requests',
    'care.pre_admission_screenings','care.initial_screenings',
    'care.advance_directives','care.resident_face_sheets',
    'care.resident_specific_plans','care.medications',
    'care.daily_progress_notes_v2','care.incident_reports',
    'care.evacuation_drills','care.staff_time_records',
    'care.nursing_admissions','care.mental_status_exams','care.suicide_risk_assessments',
    'care.notifications'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_updated_at'
        AND tgrelid = t::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %s
         FOR EACH ROW EXECUTE FUNCTION care.set_updated_at()', t
      );
    END IF;
  END LOOP;
END $$;

-- Signed-note lock trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_lock_signed_progress_note'
      AND tgrelid = 'care.progress_notes'::regclass
  ) THEN
    CREATE TRIGGER trg_lock_signed_progress_note
      BEFORE UPDATE ON care.progress_notes
      FOR EACH ROW EXECUTE FUNCTION care.lock_signed_progress_note();
  END IF;
END $$;

-- PHI audit triggers on clinical tables
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'care.pre_admission_screenings','care.initial_screenings',
    'care.advance_directives','care.incident_reports',
    'care.drug_disposal_records','care.daily_progress_notes_v2',
    'care.medications','care.medication_administrations',
    'care.resident_specific_plans',
    'care.nursing_admissions','care.mental_status_exams',
    'care.suicide_risk_assessments'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_audit_phi' AND tgrelid = t::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_audit_phi
         AFTER INSERT OR UPDATE OR DELETE ON %s
         FOR EACH ROW EXECUTE FUNCTION audit_log.log_phi_event()', t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 11. Indexes
-- ---------------------------------------------------------------------------

-- ref
CREATE INDEX IF NOT EXISTS idx_staff_tenant        ON ref.staff(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_email         ON ref.staff(email);

-- core care
CREATE INDEX IF NOT EXISTS idx_residents_tenant        ON care.residents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_residents_status        ON care.residents(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_accounts_email     ON care.user_accounts(email);
CREATE INDEX IF NOT EXISTS idx_user_accounts_staff     ON care.user_accounts(staff_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_resident     ON care.care_plans(resident_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_status       ON care.care_plans(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_goals_care_plan         ON care.goals(care_plan_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_objectives_goal         ON care.objectives(goal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_progress_notes_obj      ON care.progress_notes(objective_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_roi_resident            ON care.roi_records(resident_id);
CREATE INDEX IF NOT EXISTS idx_roi_expiring            ON care.roi_records(tenant_id, expiration_date) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_care_team_resident      ON care.care_team_members(resident_id) WHERE deleted_at IS NULL;

-- clinical operations
CREATE INDEX IF NOT EXISTS idx_pre_screen_resident     ON care.pre_admission_screenings(resident_id) WHERE resident_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pre_screen_outcome      ON care.pre_admission_screenings(screening_outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_init_screen_resident    ON care.initial_screenings(resident_id) WHERE resident_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_adv_dir_resident        ON care.advance_directives(resident_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rsp_resident            ON care.resident_specific_plans(resident_id, plan_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_notes_resident    ON care.daily_progress_notes_v2(resident_id, note_date DESC, shift);
CREATE INDEX IF NOT EXISTS idx_daily_notes_date        ON care.daily_progress_notes_v2(note_date DESC);
CREATE INDEX IF NOT EXISTS idx_meds_resident           ON care.medications(resident_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mar_resident            ON care.medication_administrations(resident_id, administered_at DESC);
CREATE INDEX IF NOT EXISTS idx_mar_medication          ON care.medication_administrations(medication_id, administered_at DESC);
CREATE INDEX IF NOT EXISTS idx_glucose_resident        ON care.blood_glucose_readings(resident_id, reading_time DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_resident      ON care.incident_reports(resident_id, incident_date DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_type          ON care.incident_reports(tenant_id, incident_type, incident_date DESC);
CREATE INDEX IF NOT EXISTS idx_evac_drills_date        ON care.evacuation_drills(tenant_id, drill_date DESC);
CREATE INDEX IF NOT EXISTS idx_disposal_resident       ON care.drug_disposal_records(resident_id, disposal_date DESC);
CREATE INDEX IF NOT EXISTS idx_disposal_controlled     ON care.drug_disposal_records(tenant_id, disposal_date DESC) WHERE is_controlled_substance = TRUE;
CREATE INDEX IF NOT EXISTS idx_time_records_staff      ON care.staff_time_records(staff_id, clock_in DESC);
CREATE INDEX IF NOT EXISTS idx_time_records_open       ON care.staff_time_records(tenant_id, staff_id) WHERE clock_out IS NULL;

-- new tables
CREATE INDEX IF NOT EXISTS idx_staff_certs_staff        ON ref.staff_certifications(staff_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_staff_certs_expiry       ON ref.staff_certifications(tenant_id, expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user       ON care.notifications(user_id, created_at DESC) WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_tenant     ON care.notifications(tenant_id, created_at DESC) WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_resident   ON care.notifications(resident_id) WHERE resident_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_document   ON care.notifications(document_id) WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_admission  ON care.notifications(related_admission_id, created_at DESC) WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cplan_cultural           ON care.care_plan_cultural_identity(care_plan_id);
CREATE INDEX IF NOT EXISTS idx_cplan_signatures         ON care.care_plan_signatures(care_plan_id);
CREATE INDEX IF NOT EXISTS idx_resident_requests        ON care.resident_requests(resident_id, submitted_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resident_requests_status ON care.resident_requests(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_injury_zones_incident    ON care.incident_injury_zones(incident_id);
CREATE INDEX IF NOT EXISTS idx_nursing_admissions       ON care.nursing_admissions(resident_id, admission_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mse_resident             ON care.mental_status_exams(resident_id, exam_date DESC);
CREATE INDEX IF NOT EXISTS idx_mse_admission            ON care.mental_status_exams(nursing_admission_id) WHERE nursing_admission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suicide_risk_resident    ON care.suicide_risk_assessments(resident_id, assessment_date DESC);

-- audit
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time       ON audit_log.event_log(tenant_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resident_time     ON audit_log.event_log(resident_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor             ON audit_log.event_log(actor_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_credential_history_user ON audit_log.credential_history(user_account_id);
CREATE INDEX IF NOT EXISTS idx_credential_history_staff ON audit_log.credential_history(staff_id);
CREATE INDEX IF NOT EXISTS idx_credential_history_resident ON audit_log.credential_history(resident_id);
CREATE INDEX IF NOT EXISTS idx_credential_history_generated_at ON audit_log.credential_history(generated_at);

-- ---------------------------------------------------------------------------
-- 12. Views
-- ---------------------------------------------------------------------------

-- Active residents with care plan KPI flags
CREATE OR REPLACE VIEW care.v_active_residents_with_plan AS
SELECT
  r.id            AS resident_id,
  r.tenant_id,
  r.first_name, r.last_name, r.status, r.intake_date,
  cp.id           AS care_plan_id,
  cp.plan_type, cp.effective_date, cp.expiration_date, cp.review_date,
  cp.status       AS plan_status,
  (cp.expiration_date IS NOT NULL
    AND cp.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
    AND cp.expiration_date > CURRENT_DATE)   AS plan_expiring_soon,
  (cp.review_date IS NOT NULL
    AND cp.review_date < CURRENT_DATE)        AS review_overdue
FROM care.residents r
LEFT JOIN care.care_plans cp
       ON cp.resident_id = r.id AND cp.status = 'active' AND cp.deleted_at IS NULL
WHERE r.status = 'active' AND r.deleted_at IS NULL;

-- High-risk residents (any risk dimension = high or imminent)
CREATE OR REPLACE VIEW care.v_high_risk_residents AS
SELECT
  r.id AS resident_id, r.tenant_id, r.first_name, r.last_name, r.status,
  cp.id AS care_plan_id,
  sp.suicide_risk_level, sp.self_harm_risk_level,
  sp.aggression_risk_level, sp.awol_risk_level, sp.last_reviewed_at
FROM care.residents r
JOIN care.care_plans cp
  ON cp.resident_id = r.id AND cp.status = 'active' AND cp.deleted_at IS NULL
JOIN care.safety_plans sp ON sp.care_plan_id = cp.id
WHERE r.deleted_at IS NULL AND r.status = 'active'
  AND (
    sp.suicide_risk_level    IN ('high','imminent')
    OR sp.self_harm_risk_level  = 'high'
    OR sp.aggression_risk_level = 'high'
    OR sp.awol_risk_level       = 'high'
  );

-- ROI records expiring within 30 days
CREATE OR REPLACE VIEW care.v_roi_expiring_soon AS
SELECT
  roi.id, roi.resident_id, roi.tenant_id,
  r.first_name, r.last_name,
  roi.recipient_name, roi.recipient_type, roi.expiration_date,
  (roi.expiration_date - CURRENT_DATE) AS days_until_expiry
FROM care.roi_records roi
JOIN care.residents r ON r.id = roi.resident_id
WHERE roi.is_active = TRUE
  AND roi.expiration_date IS NOT NULL
  AND roi.expiration_date >= CURRENT_DATE
  AND roi.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
  AND r.deleted_at IS NULL;

-- Unsigned daily notes
CREATE OR REPLACE VIEW care.v_unsigned_daily_notes AS
SELECT
  n.id, n.tenant_id, n.resident_id, n.note_date, n.shift,
  r.first_name, r.last_name,
  s.first_name || ' ' || s.last_name AS authored_by_name,
  (CURRENT_DATE - n.note_date)        AS days_unsigned
FROM care.daily_progress_notes_v2 n
JOIN care.residents r ON r.id = n.resident_id
LEFT JOIN ref.staff  s ON s.id = n.authored_by
WHERE n.signed_at IS NULL AND n.deleted_at IS NULL AND n.note_date < CURRENT_DATE
ORDER BY n.note_date ASC;

-- Residents missing an active advance directive
CREATE OR REPLACE VIEW care.v_missing_advance_directives AS
SELECT r.id, r.tenant_id, r.first_name, r.last_name, r.intake_date
FROM care.residents r
WHERE r.deleted_at IS NULL AND r.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM care.advance_directives ad
    WHERE ad.resident_id = r.id AND ad.is_active = TRUE AND ad.deleted_at IS NULL
  );

-- Controlled-substance disposals missing a witness
CREATE OR REPLACE VIEW care.v_disposal_missing_witness AS
SELECT d.id, d.tenant_id, d.resident_id, d.disposal_date,
       d.drug_name, d.drug_strength, d.quantity_disposed,
       r.first_name, r.last_name
FROM care.drug_disposal_records d
JOIN care.residents r ON r.id = d.resident_id
WHERE d.is_controlled_substance = TRUE
  AND (d.witness_name IS NULL OR d.witness_staff_id IS NULL);

-- Staff currently clocked in
CREATE OR REPLACE VIEW care.v_staff_clocked_in AS
SELECT
  tr.id, tr.tenant_id, tr.staff_id,
  s.first_name, s.last_name, s.role,
  tr.clock_in, tr.shift,
  ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - tr.clock_in)) / 3600, 2) AS hours_on_clock
FROM care.staff_time_records tr
JOIN ref.staff s ON s.id = tr.staff_id
WHERE tr.clock_out IS NULL
ORDER BY tr.clock_in ASC;

-- Incident summary — rolling 30 days
CREATE OR REPLACE VIEW care.v_incident_summary_30d AS
SELECT
  tenant_id, incident_type,
  COUNT(*) AS count,
  COUNT(*) FILTER (WHERE incident_type = 'suspected_abuse_neglect') AS abuse_neglect_count
FROM care.incident_reports
WHERE deleted_at IS NULL AND incident_date >= CURRENT_DATE - 30
GROUP BY tenant_id, incident_type;

-- ---------------------------------------------------------------------------
-- 13. Row-Level Security  (tenant isolation)
-- ---------------------------------------------------------------------------

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- core
    'care.residents','care.representatives','care.user_accounts',
    'care.care_plans','care.domain_assessments',
    'care.goals','care.objectives','care.progress_notes',
    'care.safety_plans','care.daily_living_needs','care.discharge_plans',
    'care.legal_advocacy','care.care_team_members','care.roi_records',
    'care.notifications','care.care_plan_cultural_identity',
    'care.care_plan_signatures','care.resident_requests',
    -- admission / operations
    'care.pre_admission_screenings','care.initial_screenings',
    'care.advance_directives','care.resident_face_sheets',
    'care.resident_specific_plans','care.medications',
    'care.medication_administrations','care.blood_glucose_readings',
    'care.daily_progress_notes_v2','care.incident_reports',
    'care.incident_injury_zones','care.drug_disposal_records',
    'care.evacuation_drills','care.staff_time_records',
    'care.nursing_admissions','care.mental_status_exams',
    'care.suicide_risk_assessments'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %s', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s
       USING      (tenant_id = care.current_tenant_id())
       WITH CHECK (tenant_id = care.current_tenant_id())', t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 14. Grants
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA ref, care, audit_log TO care_app_rw, care_app_ro;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ref.tenants','ref.staff','ref.organizations','ref.staff_certifications',
    'care.residents','care.representatives','care.user_accounts',
    'care.care_plans','care.domain_assessments',
    'care.goals','care.objectives','care.progress_notes',
    'care.safety_plans','care.daily_living_needs','care.discharge_plans',
    'care.legal_advocacy','care.care_team_members','care.roi_records',
    'care.notifications','care.care_plan_cultural_identity',
    'care.care_plan_signatures','care.resident_requests',
    'care.pre_admission_screenings','care.initial_screenings',
    'care.advance_directives','care.resident_face_sheets',
    'care.resident_specific_plans','care.medications',
    'care.medication_administrations','care.blood_glucose_readings',
    'care.daily_progress_notes_v2','care.incident_reports',
    'care.incident_notifications','care.incident_injury_zones',
    'care.evacuation_drills','care.evacuation_drill_participants',
    'care.drug_disposal_records','care.staff_time_records',
    'care.nursing_admissions','care.mental_status_exams',
    'care.suicide_risk_assessments'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO care_app_rw', t);
    EXECUTE format('GRANT SELECT ON %s TO care_app_ro', t);
  END LOOP;
END $$;

GRANT INSERT ON audit_log.event_log TO care_app_rw, care_app_ro;
GRANT SELECT ON audit_log.event_log TO care_app_rw;

-- ============================================================================
-- Migration 0011: Pending Admissions Workflow
-- ============================================================================
-- care.pending_admissions stores admission form data (pre-screening, nursing
-- assessment, advance directive) in one row before approval. On approval,
-- a care.residents row is created and resident_id is set back here.


CREATE TABLE IF NOT EXISTS care.pending_admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES ref.tenants(id) ON DELETE RESTRICT,
  resident_id UUID REFERENCES care.residents(id) ON DELETE SET NULL,

  -- Workflow status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by UUID NOT NULL REFERENCES ref.staff(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES ref.staff(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Form completion flags (so the wizard can save partial progress)
  pre_screening_complete BOOLEAN NOT NULL DEFAULT FALSE,
  nursing_assessment_complete BOOLEAN NOT NULL DEFAULT FALSE,
  advance_directive_complete BOOLEAN NOT NULL DEFAULT FALSE,

  -- ── PRE-SCREENING ─────────────────────────────────────────────────────────
  -- Identity & contact (encrypted at rest)
  full_name TEXT,
  preferred_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  pronoun TEXT,
  contact_phone TEXT,
  email TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  language_preference TEXT,
  tribal_affiliation TEXT,
  spiritual_religious TEXT,
  -- Emergency contact
  emergency_contact TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  -- Medical pre-screening
  primary_physician TEXT,
  primary_physician_phone TEXT,
  primary_diagnosis TEXT,
  allergies TEXT,
  current_medications TEXT,
  medical_conditions TEXT,
  vision_hearing TEXT,
  mobility_aids TEXT,
  -- Legal & insurance
  legal_status TEXT,
  has_guardian BOOLEAN,
  guardian_representative TEXT,
  insurance_type TEXT,
  insurance_member_id TEXT,
  insurance_group_number TEXT,
  insurance_provider TEXT,
  insurance_contact_phone TEXT,
  medicaid_id TEXT,
  ssn_last4 TEXT,

  -- ── NURSING ASSESSMENT ────────────────────────────────────────────────────
  assessment_date DATE,
  vital_temperature NUMERIC(5, 2),
  vital_bp_systolic INT,
  vital_bp_diastolic INT,
  vital_pulse INT,
  vital_respiration INT,
  vital_oxygen NUMERIC(5, 2),
  weight_lbs NUMERIC(6, 2),
  height_inches NUMERIC(5, 2),
  skin_assessment TEXT,
  sleep_history TEXT,
  pain_level INT CHECK (pain_level IS NULL OR (pain_level >= 0 AND pain_level <= 10)),
  pain_location TEXT,
  functional_mobility TEXT,
  fall_risk TEXT,
  suicide_risk TEXT,
  sexual_history_risk TEXT,
  violence_risk TEXT,
  substance_abuse_history TEXT,
  substance_use_flag BOOLEAN,
  legal_risk_flag BOOLEAN,
  mental_health_assessment TEXT,
  opioid_sedation_scale INT,
  nursing_assessment_notes TEXT,

  -- ── ADVANCE DIRECTIVE ─────────────────────────────────────────────────────
  has_advance_directive BOOLEAN,
  healthcare_agent_name TEXT,
  healthcare_agent_phone TEXT,
  healthcare_agent_relationship TEXT,
  alternate_agent_name TEXT,
  alternate_agent_phone TEXT,
  mental_health_preferences TEXT,
  psychiatric_med_preferences TEXT,
  hospitalization_preference TEXT,
  emergency_interventions TEXT,
  specific_treatment_preferences TEXT,
  personal_values TEXT,
  religious_cultural_preferences TEXT,
  end_of_life_wishes TEXT,
  resident_signature TEXT,
  resident_signature_date DATE,
  witness1_name TEXT,
  witness1_signature TEXT,
  witness1_date DATE,
  witness2_name TEXT,
  witness2_signature TEXT,
  witness2_date DATE,

  -- Encryption metadata
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  encrypted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pending_admissions_tenant ON care.pending_admissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pending_admissions_status_tenant ON care.pending_admissions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_admissions_created ON care.pending_admissions(created_at DESC);

CREATE TRIGGER trg_pending_admissions_updated_at BEFORE UPDATE ON care.pending_admissions
  FOR EACH ROW EXECUTE FUNCTION care.set_updated_at();

ALTER TABLE care.pending_admissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pending_admissions_tenant_isolation ON care.pending_admissions;

CREATE POLICY pending_admissions_tenant_isolation ON care.pending_admissions
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);


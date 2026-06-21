-- Complete Database Schema with All Migrations Applied
-- Created: 2026-05-15
-- Includes: Multi-tenant setup, all extended forms, credential audit trail

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEMAS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS ref;
CREATE SCHEMA IF NOT EXISTS care;
CREATE SCHEMA IF NOT EXISTS audit_log;

-- ─────────────────────────────────────────────────────────────────────────────
-- REF SCHEMA - Reference/Master Data
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref.tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ref.staff (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES ref.tenants(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(50),
  shift VARCHAR(50),
  hire_date DATE,
  employee_id VARCHAR(100),
  emergency_contact VARCHAR(255),
  certifications TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, employee_id)
);

CREATE INDEX idx_staff_tenant ON ref.staff(tenant_id);
CREATE INDEX idx_staff_is_active ON ref.staff(is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- CARE SCHEMA - Clinical Data
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS care.residents (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES ref.tenants(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(50),
  preferred_pronouns VARCHAR(50),
  medicaid_id VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),
  admission_date DATE,
  primary_diagnosis VARCHAR(255),
  legal_status VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  created_by INTEGER REFERENCES ref.staff(id),
  updated_by INTEGER REFERENCES ref.staff(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_residents_tenant ON care.residents(tenant_id);
CREATE INDEX idx_residents_status ON care.residents(status);

CREATE TABLE IF NOT EXISTS care.user_accounts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES ref.tenants(id),
  staff_id INTEGER REFERENCES ref.staff(id),
  resident_id INTEGER REFERENCES care.residents(id),
  email VARCHAR(255),
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  password_changed_required BOOLEAN DEFAULT false,
  password_changed_at TIMESTAMP,
  last_login TIMESTAMP,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, username)
);

CREATE INDEX idx_user_accounts_tenant ON care.user_accounts(tenant_id);
CREATE INDEX idx_user_accounts_staff_id ON care.user_accounts(staff_id);
CREATE INDEX idx_user_accounts_resident_id ON care.user_accounts(resident_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- NURSING ADMISSION ASSESSMENT (8-STEP)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS care.nursing_admissions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES ref.tenants(id),
  resident_id INTEGER NOT NULL REFERENCES care.residents(id),

  -- Step 1: Demographics
  step_1_completed BOOLEAN DEFAULT false,
  marital_status VARCHAR(50),
  next_of_kin VARCHAR(255),
  kin_relationship VARCHAR(50),
  kin_phone VARCHAR(20),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  insurance_provider VARCHAR(255),
  insurance_member_id VARCHAR(100),
  policy_group_number VARCHAR(100),

  -- Step 2: Vital Signs & Physical Assessment
  step_2_completed BOOLEAN DEFAULT false,
  height_inches NUMERIC(5,2),
  weight_lbs NUMERIC(7,2),
  bmi NUMERIC(5,2),
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  heart_rate INTEGER,
  respiration_rate INTEGER,
  temperature_f NUMERIC(5,2),
  oxygen_saturation INTEGER,
  general_appearance TEXT,
  skin_condition TEXT,
  nutritional_status VARCHAR(50),

  -- Step 3: Systems Review
  step_3_completed BOOLEAN DEFAULT false,
  cardiovascular_assessment TEXT,
  respiratory_assessment TEXT,
  gastrointestinal_assessment TEXT,
  neurological_assessment TEXT,
  musculoskeletal_assessment TEXT,
  genitourinary_assessment TEXT,

  -- Step 4: Pain, Sleep & Nutrition
  step_4_completed BOOLEAN DEFAULT false,
  pain_level INTEGER,
  pain_location TEXT,
  pain_characteristics TEXT,
  pain_management_current TEXT,
  sleep_pattern TEXT,
  sleep_disturbances TEXT,
  nutritional_intake TEXT,
  dietary_restrictions TEXT,
  feeding_assistance_required BOOLEAN,

  -- Step 5: Substance Abuse History
  step_5_completed BOOLEAN DEFAULT false,
  alcohol_use_history TEXT,
  alcohol_current_use BOOLEAN,
  drug_use_history TEXT,
  drug_current_use BOOLEAN,
  tobacco_use_history TEXT,
  tobacco_current_use BOOLEAN,
  substance_abuse_treatment_history TEXT,

  -- Step 6: Risk Assessments
  step_6_completed BOOLEAN DEFAULT false,
  fall_risk_score INTEGER,
  fall_risk_level VARCHAR(50),
  pressure_ulcer_risk_score INTEGER,
  pressure_ulcer_risk_level VARCHAR(50),
  infection_risk TEXT,
  aspiration_risk BOOLEAN,
  self_harm_risk BOOLEAN,
  elopement_risk BOOLEAN,

  -- Step 7: Suicide Risk Assessment
  step_7_completed BOOLEAN DEFAULT false,
  suicidal_ideation BOOLEAN,
  suicide_plan BOOLEAN,
  suicide_intent BOOLEAN,
  previous_suicide_attempts INTEGER,
  protective_factors TEXT,

  -- Step 8: Summary & Sign-off
  step_8_completed BOOLEAN DEFAULT false,
  clinical_summary TEXT,
  assessment_completed_by INTEGER REFERENCES ref.staff(id),
  assessment_date DATE,
  supervisor_review_date DATE,
  supervisor_id INTEGER REFERENCES ref.staff(id),

  submitted_at TIMESTAMP,
  submitted_by INTEGER REFERENCES ref.staff(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nursing_admissions_tenant ON care.nursing_admissions(tenant_id);
CREATE INDEX idx_nursing_admissions_resident ON care.nursing_admissions(resident_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ADVANCE DIRECTIVES (6-STEP)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS care.advance_directives (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES ref.tenants(id),
  resident_id INTEGER NOT NULL REFERENCES care.residents(id),

  -- Step 1: Resident Information
  step_1_completed BOOLEAN DEFAULT false,
  directive_type VARCHAR(100),
  directive_date DATE,

  -- Step 2: Healthcare Agent/Power of Attorney
  step_2_completed BOOLEAN DEFAULT false,
  agent_name VARCHAR(255),
  agent_relationship VARCHAR(50),
  agent_phone VARCHAR(20),
  agent_email VARCHAR(255),
  agent_address TEXT,
  agent_acknowledgment_signature VARCHAR(255),
  agent_acknowledgment_date DATE,
  alternate_agent_name VARCHAR(255),
  alternate_agent_relationship VARCHAR(50),
  alternate_agent_phone VARCHAR(20),

  -- Step 3: Mental Health Treatment Preferences
  step_3_completed BOOLEAN DEFAULT false,
  mh_hospitalization_preference VARCHAR(50),
  mh_medication_preference TEXT,
  mh_therapy_preference TEXT,
  mh_crisis_contact_name VARCHAR(255),
  mh_crisis_contact_phone VARCHAR(20),

  -- Step 4: Specific Treatment Preferences
  step_4_completed BOOLEAN DEFAULT false,
  resuscitation_preference VARCHAR(50),
  mechanical_ventilation_preference VARCHAR(50),
  feeding_tube_preference VARCHAR(50),
  dialysis_preference VARCHAR(50),
  blood_transfusion_preference VARCHAR(50),
  organ_donation_preference VARCHAR(50),
  pain_management_preference TEXT,

  -- Step 5: Personal Values & Culture
  step_5_completed BOOLEAN DEFAULT false,
  cultural_beliefs TEXT,
  religious_beliefs TEXT,
  important_life_values TEXT,
  spiritual_practices TEXT,

  -- Step 6: End-of-Life & Signatures
  step_6_completed BOOLEAN DEFAULT false,
  quality_of_life_preferences TEXT,
  palliative_care_preferences TEXT,
  location_of_death_preference VARCHAR(100),
  funeral_arrangements TEXT,
  resident_signature VARCHAR(255),
  resident_signature_date DATE,
  witness_1_name VARCHAR(255),
  witness_1_signature VARCHAR(255),
  witness_1_signature_date DATE,
  witness_2_name VARCHAR(255),
  witness_2_signature VARCHAR(255),
  witness_2_signature_date DATE,
  notary_public_stamp VARCHAR(255),

  submitted_at TIMESTAMP,
  submitted_by INTEGER REFERENCES ref.staff(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_advance_directives_tenant ON care.advance_directives(tenant_id);
CREATE INDEX idx_advance_directives_resident ON care.advance_directives(resident_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- PRE-ADMISSION SCREENING (6-STEP)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS care.pre_admission_screenings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES ref.tenants(id),
  resident_id INTEGER NOT NULL REFERENCES care.residents(id),

  -- Step 1: Referral & Funding
  step_1_completed BOOLEAN DEFAULT false,
  referral_source VARCHAR(100),
  referral_date DATE,
  funding_source VARCHAR(100),
  insurance_type VARCHAR(100),
  estimated_length_of_stay_days INTEGER,

  -- Step 2: Mental Health History
  step_2_completed BOOLEAN DEFAULT false,
  mh_diagnosis_primary VARCHAR(255),
  mh_diagnosis_secondary VARCHAR(255),
  mh_treatment_previous TEXT,
  mh_hospitalizations INTEGER,
  mh_current_medications JSONB,

  -- Step 3: Medical History
  step_3_completed BOOLEAN DEFAULT false,
  medical_history_summary TEXT,
  chronic_conditions JSONB,
  current_medications JSONB,
  medication_allergies TEXT,
  medical_allergies TEXT,
  surgical_history TEXT,

  -- Step 4: Substance Use History
  step_4_completed BOOLEAN DEFAULT false,
  substance_use_summary TEXT,
  primary_substance VARCHAR(100),
  age_of_first_use INTEGER,
  treatment_history TEXT,
  recovery_status VARCHAR(50),

  -- Step 5: Psychosocial & Legal
  step_5_completed BOOLEAN DEFAULT false,
  family_support_available BOOLEAN,
  family_contacts TEXT,
  employment_status VARCHAR(50),
  housing_status VARCHAR(50),
  legal_issues TEXT,
  court_ordered_treatment BOOLEAN,

  -- Step 6: Level of Care & Summary
  step_6_completed BOOLEAN DEFAULT false,
  recommended_level_of_care VARCHAR(100),
  clinical_summary TEXT,
  screening_clinician_name VARCHAR(255),
  screening_clinician_license VARCHAR(100),
  screening_date DATE,
  admission_recommended BOOLEAN,

  submitted_at TIMESTAMP,
  submitted_by INTEGER REFERENCES ref.staff(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pre_screenings_tenant ON care.pre_admission_screenings(tenant_id);
CREATE INDEX idx_pre_screenings_resident ON care.pre_admission_screenings(resident_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- CARE PLANS (7-STEP)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS care.care_plans (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES ref.tenants(id),
  resident_id INTEGER NOT NULL REFERENCES care.residents(id),

  -- Step 1: Patient & Plan Information
  step_1_completed BOOLEAN DEFAULT false,
  plan_type VARCHAR(100),
  effective_date DATE,
  review_schedule VARCHAR(50),
  plan_frequency_days INTEGER,

  -- Step 2: Care Planning Team
  step_2_completed BOOLEAN DEFAULT false,
  cmhp_last_name VARCHAR(100),
  cmhp_first_name VARCHAR(100),
  cmhp_organization VARCHAR(255),
  cmhp_license VARCHAR(100),
  isp_team_members JSONB,

  -- Step 3: Core Assessment
  step_3_completed BOOLEAN DEFAULT false,
  selected_domains JSONB,
  physical_health_assessment TEXT,
  mental_health_assessment TEXT,
  substance_use_assessment TEXT,
  social_functioning_assessment TEXT,
  occupational_assessment TEXT,
  family_support_assessment TEXT,
  housing_assessment TEXT,

  -- Step 4: Recovery Goals (3 goals with 2 objectives each)
  step_4_completed BOOLEAN DEFAULT false,
  goal_1_statement TEXT,
  goal_1_objective_1 TEXT,
  goal_1_objective_2 TEXT,
  goal_2_statement TEXT,
  goal_2_objective_1 TEXT,
  goal_2_objective_2 TEXT,
  goal_3_statement TEXT,
  goal_3_objective_1 TEXT,
  goal_3_objective_2 TEXT,

  -- Step 5: Safety & Risk Planning
  step_5_completed BOOLEAN DEFAULT false,
  crisis_warning_signs TEXT,
  crisis_coping_strategies TEXT,
  suicide_protocol TEXT,
  self_harm_protocol TEXT,
  substance_relapse_triggers TEXT,
  emergency_resources TEXT,

  -- Step 6: Community & Discharge Planning
  step_6_completed BOOLEAN DEFAULT false,
  discharge_housing_plan VARCHAR(255),
  discharge_target_date DATE,
  community_resources_identified TEXT,
  follow_up_appointments TEXT,

  -- Step 7: Legal & Signatures
  step_7_completed BOOLEAN DEFAULT false,
  client_signature VARCHAR(255),
  client_signature_date DATE,
  director_signature VARCHAR(255),
  director_signature_date DATE,
  cmhp_signature VARCHAR(255),
  cmhp_signature_date DATE,

  submitted_at TIMESTAMP,
  submitted_by INTEGER REFERENCES ref.staff(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_care_plans_tenant ON care.care_plans(tenant_id);
CREATE INDEX idx_care_plans_resident ON care.care_plans(resident_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- DRUG DISPOSAL RECORDS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS care.drug_disposal_records (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES ref.tenants(id),
  resident_id INTEGER NOT NULL REFERENCES care.residents(id),
  disposal_date DATE NOT NULL,
  drug_name VARCHAR(255) NOT NULL,
  drug_strength VARCHAR(100),
  quantity_disposed NUMERIC(10,2),
  quantity_unit VARCHAR(50),
  disposal_reason VARCHAR(100),
  disposal_reason_other TEXT,
  disposal_method VARCHAR(100),
  disposal_method_other TEXT,
  counting_staff_id INTEGER REFERENCES ref.staff(id),
  counting_staff_name VARCHAR(255),
  witness_staff_id INTEGER REFERENCES ref.staff(id),
  witness_name VARCHAR(255),
  is_controlled_substance BOOLEAN DEFAULT false,
  created_by INTEGER REFERENCES ref.staff(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_drug_disposal_tenant ON care.drug_disposal_records(tenant_id);
CREATE INDEX idx_drug_disposal_resident ON care.drug_disposal_records(resident_id);
CREATE INDEX idx_drug_disposal_date ON care.drug_disposal_records(disposal_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT LOG SCHEMA - Credential & Security Audit Trail
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log.credential_history (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES ref.tenants(id),
  user_account_id INTEGER REFERENCES care.user_accounts(id),
  staff_id INTEGER REFERENCES ref.staff(id),
  resident_id INTEGER REFERENCES care.residents(id),
  credential_type VARCHAR(50) NOT NULL,
  username VARCHAR(100),
  password_hash VARCHAR(255),
  was_temporary BOOLEAN DEFAULT true,
  generated_by INTEGER REFERENCES ref.staff(id),
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  first_login_at TIMESTAMP,
  password_changed_at TIMESTAMP,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credential_history_tenant ON audit_log.credential_history(tenant_id);
CREATE INDEX idx_credential_history_user_account ON audit_log.credential_history(user_account_id);
CREATE INDEX idx_credential_history_staff ON audit_log.credential_history(staff_id);
CREATE INDEX idx_credential_history_resident ON audit_log.credential_history(resident_id);
CREATE INDEX idx_credential_history_generated_at ON audit_log.credential_history(generated_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DATA - Default Tenant
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ref.tenants (name, slug) VALUES ('Default Facility', 'default')
ON CONFLICT (slug) DO NOTHING;

COMMIT;

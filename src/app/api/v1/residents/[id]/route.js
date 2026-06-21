import { authenticate, authorize, guardResidentAccess, maskPHI, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient, query } from '@/lib/db.js';
import { encryptFields, decryptFields, RESIDENT_ENCRYPTED_FIELDS, REP_ENCRYPTED_FIELDS } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { getTenantKey } from '@/lib/tenant-key.js';

const audit = new AuditLogger();

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function joinName(first, last) {
  return [first, last].filter(Boolean).join(' ').trim() || null;
}

export async function GET(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_READ, PERMISSIONS.RESIDENTS_READ_OWN)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    // Guard resident_care_of users to only access their own record
    const guardResult = await guardResidentAccess(user, id);
    if (guardResult?.error) {
      return Response.json({ error: guardResult.error }, { status: guardResult.status });
    }

    const row = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `SELECT r.*,
                rep.first_name AS rep_first_name, rep.last_name AS rep_last_name,
                rep.primary_phone AS rep_phone, rep.relation_to_resident
         FROM care.residents r
         LEFT JOIN care.representatives rep ON rep.resident_id = r.id AND rep.is_primary = TRUE AND rep.deleted_at IS NULL
         WHERE r.id = $1 AND r.deleted_at IS NULL`,
        [id]
      );
      return rows[0];
    });

    if (!row) return Response.json({ error: 'Resident not found' }, { status: 404 });

    const tenantKey = await getTenantKey(user.tenantId);
    const decrypted = decryptFields(row, RESIDENT_ENCRYPTED_FIELDS, tenantKey);
    const decryptedWithRep = decryptFields(decrypted, REP_ENCRYPTED_FIELDS, tenantKey);
    const masked    = maskPHI(decryptedWithRep, user.role);

    const sourceData = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const [screeningRes, nursingRes, directiveRes] = await Promise.all([
        client.query(
          `SELECT client_full_name, ssn, contact_phone, contact_email, date_of_birth,
                  preferred_pronouns, primary_dsm5_diagnosis, pcp_name, pcp_phone,
                  outpatient_therapist, outpatient_therapist_phone,
                  outpatient_psychiatrist, outpatient_psychiatrist_phone,
                  outpatient_case_manager, outpatient_case_manager_phone,
                  current_living_situation, county_of_residence, income_source,
                  legal_status, form_data, submitted_at, created_at
             FROM care.pre_admission_screenings
            WHERE resident_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
            ORDER BY COALESCE(submitted_at, created_at) DESC
            LIMIT 1`,
          [row.id, user.tenantId]
        ),
        client.query(
          `SELECT full_name, date_of_birth, preferred_name, pronouns, gender,
                  language_preference, emergency_contact_name, emergency_contact_phone,
                  emergency_contact_relationship, reason_for_admission, form_data,
                  submitted_at, created_at
             FROM care.nursing_admissions
            WHERE resident_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
            ORDER BY COALESCE(submitted_at, created_at) DESC
            LIMIT 1`,
          [row.id, user.tenantId]
        ),
        client.query(
          `SELECT resident_name, agent_name, agent_relationship, agent_phone, agent_email,
                  resident_signature_date, form_data, submitted_at, created_at, status
             FROM care.advance_directives
            WHERE resident_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
            ORDER BY COALESCE(submitted_at, created_at) DESC
            LIMIT 1`,
          [row.id, user.tenantId]
        ),
      ]);

      const screening = screeningRes.rows[0] || null;
      const nursing = nursingRes.rows[0] || null;
      const directive = directiveRes.rows[0] || null;
      const screeningData = screening?.form_data && typeof screening.form_data === 'object' ? screening.form_data : {};
      const nursingData = nursing?.form_data && typeof nursing.form_data === 'object' ? nursing.form_data : {};
      const directiveData = directive?.form_data && typeof directive.form_data === 'object' ? directive.form_data : {};

      const decryptedScreening = screening
        ? decryptFields(
            {
              client_full_name: screening.client_full_name,
              ssn: screening.ssn,
              contact_phone: screening.contact_phone,
              contact_email: screening.contact_email,
            },
            ['client_full_name', 'ssn', 'contact_phone', 'contact_email'],
            tenantKey
          )
        : {};

      const fullName = joinName(decrypted.first_name, decrypted.last_name) || decryptedScreening.client_full_name || nursingData.name || nursingData.full_name || directiveData.resident_name || null;
      const preferredName = firstDefined(decrypted.preferred_name, nursing?.preferred_name, nursingData.preferredName, screeningData.preferredName);
      const pronouns = firstDefined(decrypted.pronoun, screening?.preferred_pronouns, nursing?.pronouns, nursingData.pronouns, screeningData.pronouns);
      const gender = firstDefined(decrypted.gender, nursing?.gender, nursingData.gender);
      const dob = firstDefined(decrypted.date_of_birth, nursing?.date_of_birth, nursingData.dateOfBirth, nursingData.dob, decryptedScreening.date_of_birth, screeningData.dateOfBirth, screeningData.dob);
      const livingSituation = firstDefined(decrypted.current_living_situation, screening?.current_living_situation, screeningData.currentLivingSituation, screeningData.livingSituation, nursingData.arrivalMethod, nursingData.infoSource);
      const legalStatus = firstDefined(decrypted.legal_status, screening?.legal_status, screeningData.legalStatus);
      const primaryDiagnosis = firstDefined(decrypted.primary_diagnosis, screening?.primary_dsm5_diagnosis, screeningData.primaryDiagnosis, screeningData.primary_dsm5_diagnosis);
      const secondaryDiagnoses = firstDefined(decrypted.secondary_diagnoses, screeningData.secondaryDiagnoses, screeningData.secondary_diagnoses);
      const pcpName = firstDefined(decrypted.primary_physician, screening?.pcp_name, screeningData.pcpName);
      const pcpPhone = firstDefined(decrypted.primary_physician_phone, screening?.pcp_phone, screeningData.pcpPhone);
      const medicaidId = firstDefined(decrypted.medicaid_id, screeningData.insuranceMemberId, screeningData.otherInsuranceId);
      const insuranceType = firstDefined(decrypted.insurance_type, screeningData.otherInsurance, screeningData.insuranceType);
      const insurancePhone = firstDefined(decrypted.insurance_contact_phone, screeningData.insuranceContactPhone);
      const emergencyContact = firstDefined(
        joinName(decryptedWithRep.rep_first_name, decryptedWithRep.rep_last_name),
        nursing?.emergency_contact_name,
        nursingData.emergencyName,
        screening?.contact_person,
        screeningData.contactPerson
      );
      const emergencyContactPhone = firstDefined(decryptedWithRep.rep_phone, nursing?.emergency_contact_phone, nursingData.emergencyPhone, decryptedScreening.contact_phone, screeningData.contactPhone);
      const emergencyContactRelationship = firstDefined(decryptedWithRep.relation_to_resident, nursing?.emergency_contact_relationship, nursingData.emergencyRelationship, screeningData.contactPersonRelationship);
      const agentName = firstDefined(decrypted.guardian_representative, directive?.agent_name, directiveData.healthcare_agent_name);
      const agentRelationship = firstDefined(directive?.agent_relationship, directiveData.healthcare_agent_relationship);
      const agentPhone = firstDefined(directive?.agent_phone, directiveData.healthcare_agent_phone);
      const agentEmail = firstDefined(directive?.agent_email, directiveData.healthcare_agent_email);
      const agentAddress = firstDefined(directiveData.healthcare_agent_address, directiveData.agent_address);
      const cprPreference = directiveData.cpr_preference || null;
      const polstDnr = cprPreference ? (cprPreference === 'full' ? 'No' : 'Yes') : firstDefined(directive?.status, masked.has_advance_directive ? 'Yes' : null);
      const formCompletedDate = firstDefined(directive?.submitted_at, nursing?.submitted_at, screening?.submitted_at);
      const mobilityAids = firstDefined(decrypted.mobility_aids, screeningData.mobilityStatus, nursingData.assistiveDevice, nursingData.assistDevices);
      const allergiesMedication = firstDefined(nursingData.allergyMedication, screeningData.allergiesMedication, screeningData.allergyMedication);
      const allergiesFoodEnv = firstDefined(nursingData.allergyFood, nursingData.allergyEnvironmental, nursingData.allergyLatex, nursingData.allergyOther);
      const allergySeverity = firstDefined(nursingData.allergySeverity, screeningData.allergySeverity);
      const medicalConditions = firstDefined(screeningData.medicalDiagnoses, screeningData.medical_conditions, nursingData.medicalConditions);
      const currentMedications = firstDefined(screeningData.currentMedications, screeningData.current_medications, nursingData.currentMedications);
      const spiritualReligious = firstDefined(decrypted.spiritual_religious, screeningData.religiousAffiliation, screeningData.spiritualReligious);
      const languagePreference = firstDefined(decrypted.language_preference, nursing?.language_preference, nursingData.language, screeningData.preferredLanguage);
      const caseManager = firstDefined(screening?.outpatient_case_manager, screeningData.caseManagerName);
      const caseManagerPhone = firstDefined(screening?.outpatient_case_manager_phone, screeningData.caseManagerPhone);
      const therapist = firstDefined(screening?.outpatient_therapist, screeningData.therapistName);
      const therapistPhone = firstDefined(screening?.outpatient_therapist_phone, screeningData.therapistPhone);
      const psychiatrist = firstDefined(screening?.outpatient_psychiatrist, screeningData.psychiatristName);
      const psychiatristPhone = firstDefined(screening?.outpatient_psychiatrist_phone, screeningData.psychiatristPhone);

      return {
        full_name: fullName,
        legal_name: fullName,
        preferred_name: preferredName,
        preferredName,
        pronoun: pronouns,
        pronouns,
        gender,
        gender_identity: gender,
        sex: gender,
        date_of_birth: dob,
        dateOfBirth: dob,
        dob,
        spiritual_religious: spiritualReligious,
        religious_preference: spiritualReligious,
        primary_diagnosis: primaryDiagnosis,
        primaryDiagnosis,
        dsm_primary: primaryDiagnosis,
        secondary_diagnoses: secondaryDiagnoses,
        secondaryDiagnoses,
        dsm_secondary: secondaryDiagnoses,
        primary_physician: pcpName,
        primary_physician_phone: pcpPhone,
        pcpName,
        pcpPhone,
        medicaid_id: medicaidId,
        insurance_type: insuranceType,
        primary_insurance: insuranceType,
        insurance_contact_phone: insurancePhone,
        insurance_phone: insurancePhone,
        insurance_member_id: medicaidId,
        insuranceMemberId: medicaidId,
        otherInsurance: insuranceType,
        otherInsuranceId: medicaidId,
        ssn: ['admin', 'manager', 'superadmin'].includes(user.role) ? (decryptedScreening.ssn || null) : null,
        contact_phone: firstDefined(decrypted.phone, decryptedScreening.contact_phone, nursing?.emergency_contact_phone, nursingData.emergencyPhone, screeningData.contactPhone),
        email: firstDefined(decrypted.email, decryptedScreening.contact_email, directive?.agent_email, screeningData.contactEmail),
        address_line1: decrypted.address_line1 || null,
        address_line2: decrypted.address_line2 || null,
        city: decrypted.city || null,
        state: decrypted.state || null,
        postal_code: decrypted.postal_code || null,
        intake_date: firstDefined(decrypted.intake_date, screening?.submitted_at, nursing?.submitted_at, directive?.submitted_at),
        date_of_admission: firstDefined(decrypted.intake_date, screening?.submitted_at, nursing?.submitted_at, directive?.submitted_at),
        admitted_from: livingSituation,
        current_living_situation: livingSituation,
        livingSituation,
        legal_status: legalStatus,
        legalStatus,
        has_guardian: decrypted.has_guardian || false,
        guardian_representative: agentName,
        guardian_name: agentName,
        guardian_representative_relationship: agentRelationship,
        legal_rep_name: agentName,
        legal_rep_authority: agentRelationship || legalStatus,
        legal_rep_phone: agentPhone,
        legal_rep_email: agentEmail,
        legal_rep_address: agentAddress,
        emergency_contact: emergencyContact,
        emergencyName: emergencyContact,
        emergency_contact_phone: emergencyContactPhone,
        emergencyPhone: emergencyContactPhone,
        primary_name: emergencyContact,
        primary_relationship: emergencyContactRelationship,
        emergency_contact_relationship: emergencyContactRelationship,
        primary_phone_cell: emergencyContactPhone,
        primary_email: decrypted.email || decryptedScreening.contact_email || screeningData.contactEmail || null,
        case_manager: caseManager,
        case_manager_phone: caseManagerPhone,
        therapist_primary: therapist,
        therapist_name: therapist,
        therapist_contact: therapistPhone,
        therapist_phone: therapistPhone,
        psychiatrist_name: psychiatrist,
        psychiatrist_phone: psychiatristPhone,
        resident_id: row.id,
        resident_code: row.id,
        advance_directive_status: directive?.status || (masked.has_advance_directive ? 'On File' : 'Not on File'),
        has_advance_directive: masked.has_advance_directive || directive?.status === 'submitted' || directive?.status === 'admitted' || false,
        polst_dnr: polstDnr,
        polst_dnr_date: directiveData.resident_signature_date || directive?.resident_signature_date || formCompletedDate,
        evacuation_capability: decrypted.evacuation_capability || screeningData.evacuationCapability || null,
        mobility_aids: mobilityAids,
        primary_insurance: insuranceType,
        primary_policy_id: medicaidId,
        primary_group: decrypted.insurance_group_number || screeningData.insuranceGroupNumber || null,
        secondary_insurance: firstDefined(decrypted.secondary_insurance, screeningData.secondaryInsurance),
        secondary_policy_id: firstDefined(decrypted.secondary_policy_id, screeningData.secondaryInsuranceId),
        medicaid_number: medicaidId,
        insurance_phone: insurancePhone,
        subscriber: firstDefined(screeningData.contactPerson, emergencyContact),
        dsm_primary: primaryDiagnosis,
        dsm_secondary: secondaryDiagnoses,
        additional_behavioral_dx: firstDefined(screeningData.presentingProblem, nursingData.reasonForAdmission),
        physical_dx: firstDefined(screeningData.medicalDiagnoses, screeningData.medical_conditions),
        additional_medical: medicalConditions,
        allergies_medication: allergiesMedication,
        allergies_food_env: allergiesFoodEnv,
        allergy_severity: allergySeverity,
        pcp_name: pcpName,
        pcp_phone: pcpPhone,
        psychiatrist_name: psychiatrist,
        psychiatrist_phone: psychiatristPhone,
        therapist_name: therapist,
        therapist_phone: therapistPhone,
        form_completed_date: formCompletedDate,
        resident_signature_date: directiveData.resident_signature_date || directive?.resident_signature_date || null,
        cpr_preference: cprPreference,
        nutrition_preference: directiveData.nutrition_preference || null,
        ventilation_preference: directiveData.ventilation_preference || null,
        hospitalization_preference: directiveData.hospitalization_preference || null,
        pain_relief_preference: directiveData.pain_relief_preference || null,
        donation_preference: directiveData.donation_preference || null,
        end_of_life_wishes: directiveData.end_of_life_wishes || null,
        cultural_religious_practices: directiveData.cultural_religious_practices || null,
        unacceptable_quality_of_life: directiveData.unacceptable_quality_of_life || null,
        additional_instructions: directiveData.additional_instructions || null,
        pre_screening_data: screeningData,
        nursing_assessment_data: nursingData,
        advance_directive_data: directiveData,
      };
    });

    const req = getRequestContext(request, user);
    await audit.logSelect({ tableName: 'care.residents', recordId: id, residentId: id, req });

    return Response.json({ data: { ...masked, face_sheet_autofill: sourceData } });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_UPDATE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    // Guard resident_care_of users to only update their own record
    const guardResult = await guardResidentAccess(user, id);
    if (guardResult?.error) {
      return Response.json({ error: guardResult.error }, { status: guardResult.status });
    }
    const { version, ...updates } = await request.json();

    if (!version) return Response.json({ error: 'version is required for updates (optimistic locking)' }, { status: 422 });

    const tenantKey = await getTenantKey(user.tenantId);

    const { rows: current } = await query(
      'SELECT * FROM care.residents WHERE id = $1 AND deleted_at IS NULL', [id]
    );
    if (!current.length) return Response.json({ error: 'Resident not found' }, { status: 404 });
    const oldRow = current[0];

    const encryptedUpdates = encryptFields(updates, RESIDENT_ENCRYPTED_FIELDS, tenantKey);

    const allowedFields = [
      'first_name','last_name','preferred_name','pronoun','gender','date_of_birth',
      'medicaid_id','ssn_last4','phone','email','preferred_contact_method',
      'address_line1','address_line2','city','state','postal_code',
      'language_preference','tribal_affiliation','spiritual_religious','other_cultural_factors',
      'primary_diagnosis','secondary_diagnoses','substance_use_flag','legal_risk_flag',
      'intake_date','target_discharge_date','housing_type_preferred',
      'income_source_needed','aftercare_providers',
      'consent_to_treatment','consent_date','rights_notification_date',
      'grievance_procedure_date','has_advance_directive','has_guardian','guardian_representative',
      'status',
    ];

    const setClauses = [];
    const params     = [];
    for (const field of allowedFields) {
      if (field in encryptedUpdates) {
        params.push(encryptedUpdates[field]);
        setClauses.push(`${field} = $${params.length}`);
      }
    }
    if (!setClauses.length) return Response.json({ error: 'No valid fields to update' }, { status: 422 });

    params.push(version + 1);
    setClauses.push(`version = $${params.length}`);
    params.push(user.staffId);
    setClauses.push(`updated_by = $${params.length}`);
    params.push(id, version);

    const { rows: updated } = await withTenantClient(user.tenantId, user.staffId, (client) =>
      client.query(
        `UPDATE care.residents SET ${setClauses.join(', ')}
         WHERE id = $${params.length - 1} AND version = $${params.length} AND deleted_at IS NULL
         RETURNING id, status, version, updated_at`,
        params
      )
    );

    if (!updated.length) {
      return Response.json({ error: 'Record was modified by another session. Please re-fetch and retry.', code: 'OPTIMISTIC_LOCK_CONFLICT' }, { status: 409 });
    }

    const diffKeys = Object.keys(encryptedUpdates).filter(k => allowedFields.includes(k));
    const req      = getRequestContext(request, user);
    await audit.logUpdate({
      tableName: 'care.residents', recordId: id, residentId: id,
      oldValues: { version: oldRow.version, status: oldRow.status },
      newValues: { version: updated[0].version, status: updated[0].status },
      diffKeys, req,
    });

    return Response.json({ data: updated[0] });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_DELETE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    // Guard resident_care_of users (though they shouldn't have DELETE permission anyway)
    const guardResult = await guardResidentAccess(user, id);
    if (guardResult?.error) {
      return Response.json({ error: guardResult.error }, { status: guardResult.status });
    }

    const { rows } = await withTenantClient(user.tenantId, user.staffId, (client) =>
      client.query(
        `UPDATE care.residents
         SET deleted_at = NOW(), updated_by = $2, status = 'inactive'
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id`,
        [id, user.staffId]
      )
    );

    if (!rows.length) return Response.json({ error: 'Resident not found' }, { status: 404 });

    const req = getRequestContext(request, user);
    await audit.logDelete({ tableName: 'care.residents', recordId: id, residentId: id, req });

    return Response.json({ message: 'Resident record soft-deleted. PHI retained per HIPAA retention policy.' });
  } catch (err) {
    return handleError(err);
  }
}

import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard';
import { withTenantClient } from '@/lib/db';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

export async function POST(request) {
  const context = getRequestContext(request);

  try {
    const authResult = await authenticate(request);
    if (authResult.error) return new Response(JSON.stringify({ error: authResult.error }), { status: authResult.status });
    const { user } = authResult;

    const { resident_id, step, data } = await request.json();

    if (!resident_id) {
      return new Response(JSON.stringify({ error: 'resident_id required' }), { status: 400 });
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: existing } = await client.query(
        'SELECT id FROM care.pre_admission_screenings WHERE resident_id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [resident_id, user.tenantId]
      );

      let screening_id;

      if (existing.length === 0) {
        const { rows: created } = await client.query(
          `INSERT INTO care.pre_admission_screenings (tenant_id, resident_id, created_at, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`,
          [user.tenantId, resident_id]
        );
        screening_id = created[0].id;
      } else {
        screening_id = existing[0].id;
      }

      // Build update query based on step
      const updates = {
        updated_at: new Date().toISOString(),
        [`step_${step}_completed`]: true,
      };

      // Map form data to database fields
      const fieldMap = {
        1: {
          referring_agency_name: data.referringAgency,
          referral_date_admission: data.referralDate,
          contact_person_name: data.contactPerson,
          contact_phone_number: data.contactPhone,
          contact_email_address: data.contactEmail,
          ssn_number: data.ssn,
          ohp_id_number: data.ohpId,
          other_insurance_carrier: data.otherInsurance,
          other_insurance_id: data.otherInsuranceId,
          current_living_situation: data.livingSituation,
          county_of_residence_screening: data.county,
          presenting_problem_details: data.presentingProblem,
        },
        2: {
          primary_diagnosis_code: data.primaryDiagnosis,
          diagnosis_date_screening: data.diagnosisDate,
          secondary_diagnoses_screening: data.secondaryDiagnoses,
          psych_meds_list: data.psychMeds,
          psych_hospitalization_hx_screening: data.psychHx,
          psych_hospitalization_date: data.psychHxDate,
          psych_hospitalization_reason_screening: data.psychHxReason,
          therapist_name_screening: data.therapistName,
          therapist_phone_screening: data.therapistPhone,
          psychiatrist_name_screening: data.psychiatristName,
          psychiatrist_phone_screening: data.psychiatristPhone,
          case_manager_name_screening: data.caseManagerName,
          case_manager_phone_screening: data.caseManagerPhone,
        },
        3: {
          pcp_name_screening: data.pcpName,
          pcp_phone_screening: data.pcpPhone,
          pcp_fax_screening: data.pcpFax,
          medical_diagnoses_screening: data.medicalDiagnoses,
          non_psych_meds_list: data.nonPsychMeds,
          mobility_status_screening: data.mobilityStatus,
          assistive_device_type: data.assistiveDevice,
          adl_assistance_notes: data.adlNotes,
          tb_test_result_screening: data.tbResult,
          tb_test_date_screening: data.tbTestDate,
          covid_vaccination_status_screening: data.covidVaxStatus,
          other_communicable_disease_status: data.otherCommunicable,
        },
        4: {
          primary_substance_screening: data.primarySubstance,
          secondary_substances_screening: data.secondarySubstances,
          last_use_date_screening: data.lastUseDate,
          route_of_use_screening: data.routeOfUse,
          withdrawal_history_screening: data.withdrawalHx,
          withdrawal_details_screening: data.withdrawalDetails,
          previous_treatment_episodes: data.previousTreatment,
        },
        5: {
          primary_income_source_screening: data.incomeSource,
          income_details_screening: data.incomeDetails,
          legal_status_screening: data.legalStatus,
          probation_officer_name: data.poName,
          probation_officer_phone: data.poPhone,
          legal_conditions_supervision: data.legalConditions,
          willing_discuss_trauma: data.willingToDiscussTrauma,
          client_strengths_interests: data.clientStrengths,
          abh_home_assessed: data.abhAssessed,
          lmha_connected_screening: data.lmhaConnected,
          lmha_agency_name: data.lmhaAgency,
          lmha_contact_info: data.lmhaContact,
          waitlist_other_services_screening: data.waitlistServices,
        },
        6: {
          level_of_care_needs_screening: data.levelOfCareNeeds,
          level_of_care_other_needs: data.levelOfCareOther,
          strengths_summary_assessor: data.strengthsSummary,
          barriers_to_placement_screening: data.barriersToPlacement,
          assessor_recommendation_screening: data.assessorRecommendation,
          screening_outcome_screening: data.screeningOutcome,
          conditions_prior_admission_screening: data.conditionsPriorAdmission,
          assessor_name_screening: data.assessorName,
          assessor_title_screening: data.assessorTitle,
          assessor_signature_screening: data.assessorSignature,
          assessor_date_screening: data.assessorDate,
          local_crisis_line: data.localCrisisLine,
          submitted_at: new Date().toISOString(),
          submitted_by: user.staffId,
        },
      };

      const stepFields = fieldMap[step] || {};
      Object.assign(updates, stepFields);

      // Build SQL query dynamically
      const setClause = Object.keys(updates)
        .map((key, i) => `${key} = $${i + 1}`)
        .join(', ');
      const values = Object.values(updates);

      const query = `UPDATE care.pre_admission_screenings SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`;

      const { rows } = await client.query(query, [...values, screening_id]);
      return rows[0];
    });

    // Audit log PHI write
    const req = getRequestContext(request, user);
    await audit.logUpdate({
      tableName: 'care.pre_admission_screenings',
      recordId: result.id,
      residentId: resident_id,
      req,
    });

    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    return handleError(error, context);
  }
}

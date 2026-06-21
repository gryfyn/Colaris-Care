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
        'SELECT id FROM care.nursing_admissions WHERE resident_id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [resident_id, user.tenantId]
      );

      let admission_id;

      if (existing.length === 0) {
        const { rows: created } = await client.query(
          `INSERT INTO care.nursing_admissions (tenant_id, resident_id, admission_date, created_at, updated_at)
           VALUES ($1, $2, CURRENT_DATE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`,
          [user.tenantId, resident_id]
        );
        admission_id = created[0].id;
      } else {
        admission_id = existing[0].id;
      }

      // Build update query based on step
      const updates = {
        updated_at: new Date().toISOString(),
        [`step_${step}_completed`]: true,
      };

      // Map form data to database fields
      const fieldMap = {
        1: {
          full_name: data.name,
          date_of_birth: data.dob,
          age: data.age,
          gender: data.gender,
          preferred_name: data.preferredName,
          pronouns: data.pronouns,
          language_preference: data.language,
          interpreter_needed: data.interpreterNeeded === 'Yes',
          ethnicity: data.ethnicity,
          race: data.race,
          arrival_method: data.arrivalMethod,
          info_source: data.infoSource,
          spiritual_practices: data.spiritualPractices,
          spiritual_details: data.spiritualDetails,
          emergency_contact_name: data.emergencyName,
          emergency_contact_phone: data.emergencyPhone,
          emergency_contact_relationship: data.emergencyRelationship,
          reason_for_admission: data.reasonForAdmission,
          present_illness_history: data.presentIllnessHistory,
          orientation_items: data.orientationItems,
        },
        2: {
          temperature: data.temperature,
          height: data.height,
          weight_actual: data.weightActual,
          weight_stated: data.weightStated,
          no_known_allergies: data.noKnownAllergies,
          allergy_medication: data.allergyMedication,
          allergy_food: data.allergyFood,
          allergy_environmental: data.allergyEnvironmental,
          allergy_latex: data.allergyLatex,
          allergy_other: data.allergyOther,
          scalp_inspected: data.scalpInspected,
          scalp_not_inspected_reason: data.scalpNotInspectedReason,
          skin_findings: data.skinFindings,
          skin_findings_other: data.skinFindingsOther,
          skin_staff_1: data.skinStaff1,
          pulse: data.pulse,
          respirations: data.respirations,
          o2_saturation: data.o2Sat,
        },
        3: {
          neuro: data.neuro,
          neuro_denies: data.neuro_denies,
          cardio: data.cardio,
          cardio_denies: data.cardio_denies,
          respiratory: data.respiratory,
          respiratory_denies: data.respiratory_denies,
          gi: data.gi,
          gi_denies: data.gi_denies,
          renal: data.renal,
          renal_denies: data.renal_denies,
          musculo: data.musculo,
          musculo_denies: data.musculo_denies,
          eent: data.eent,
          eent_denies: data.eent_denies,
          skin: data.skin,
          skin_denies: data.skin_denies,
          tb_symptoms: data.tbSymptoms,
          tb_symptoms_denies: data.tbSymptoms_denies,
          hepatitis_symptoms: data.hepatitisSymptoms,
          hepatitis_symptoms_denies: data.hepatitisSymptoms_denies,
          hiv_symptoms: data.hivSymptoms,
          hiv_symptoms_denies: data.hivSymptoms_denies,
          flu_symptoms: data.fluSymptoms,
          flu_symptoms_denies: data.fluSymptoms_denies,
          mrsa_symptoms: data.mrsaSymptoms,
          mrsa_symptoms_denies: data.mrsaSymptoms_denies,
          flu_vax_consent: data.fluVaxConsent,
          med_surg_history: data.medSurgHistory,
          repro_female: data.reproFemale,
          repro_male: data.reproMale,
        },
        4: {
          pain_present: data.painPresent,
          pain_scale: data.painScale,
          pain_location: data.painLocation,
          pain_comfort_goal: data.painComfortGoal,
          pain_onset: data.painOnset,
          pain_duration: data.painDuration,
          pain_description: data.painDescription,
          pain_relief: data.painRelief,
          sleep_hours: data.sleepHours,
          sleep_medication: data.sleepMedication,
          sleep_medication_detail: data.sleepMedicationDetail,
          sleep_pattern: data.sleepPattern,
          sleep_apnea: data.sleepApnea,
          cpap_use: data.cpapUse,
          cpap_brought: data.cpapBrought,
          tobacco_status: data.tobaccoStatus,
          tobacco_type: data.tobaccoType,
          special_diet: data.specialDiet,
          food_allergies: data.foodAllergies,
          last_meal: data.lastMeal,
          nutrition_concerns: data.nutritionConcerns,
          adl_eating: data.adlEating,
          adl_bathing: data.adlBathing,
          adl_dressing: data.adlDressing,
          adl_toileting: data.adlToileting,
          adl_ambulation: data.adlAmbulation,
          adl_transferring: data.adlTransferring,
          assist_devices: data.assistDevices,
          can_read: data.canRead,
          can_write: data.canWrite,
          learning_challenges: data.learningChallenges,
          learning_preferences: data.learningPreferences,
        },
        5: {
          audit_c1: data.auditC1,
          audit_c2: data.auditC2,
          audit_c3: data.auditC3,
          substance_use_12mo: data.substanceUse12mo,
          sobriety_period: data.sobrietyPeriod,
          family_sa_hx: data.familySAHx,
          self_help_groups: data.selfHelpGroups,
          treatment_reason: data.treatmentReason,
          use_triggers: data.useTriggers,
          use_consequences: data.useConsequences,
          alcohol_detox_hx: data.alcoholDetoxHx,
          alcohol_seizure_hx: data.alcoholSeizureHx,
          loc: data.loc,
          orientation: data.orientation,
          attention: data.attention,
          appearance: data.appearance,
          behavior: data.behavior,
          interactions: data.interactions,
          psychomotor: data.psychomotor,
          speech: data.speech,
          mood: data.mood,
          affect: data.affect,
          thought_process: data.thoughtProcess,
          thought_content: data.thoughtContent,
          hallucinations: data.hallucinations,
          insight: data.insight,
          judgment: data.judgment,
          mse_comments: data.mseComments,
        },
        6: {
          elopement_risk: data.elopementRisk,
          violence_hcw: data.violenceHcw,
          violence_history: data.violenceHistory,
          violence_risk_factors: data.violenceRiskFactors,
          violence_comments: data.violenceComments,
          trauma_history: data.traumaHistory,
          sexual_victimization_6mo: data.sexualVictimization6mo,
          sexual_victimization_lifetime: data.sexualVictimizationLifetime,
          sexual_victimization_indicators: data.sexualVictimizationIndicators,
          sexual_aggression_6mo: data.sexualAggression6mo,
          sexual_aggression_lifetime: data.sexualAggressionLifetime,
          sexual_aggression_indicators: data.sexualAggressionIndicators,
          restraint_sexual_abuse: data.restraintSexualAbuse,
          restraint_physical_abuse: data.restraintPhysicalAbuse,
          restraint_medical_issues: data.restraintMedicalIssues,
          restraint_notify: data.restraintNotify,
        },
        7: {
          suicide_protective: data.suicideProtective,
          suicide_risk: data.suicideRisk,
          csrs1: data.csrs1,
          csrs2: data.csrs2,
          csrs3: data.csrs3,
          csrs4: data.csrs4,
          csrs5: data.csrs5,
          csrs6: data.csrs6,
          summary_risk_suicide: data.summaryRiskSuicide,
          summary_risk_fall: data.summaryRiskFall,
          summary_risk_assault: data.summaryRiskAssault,
          summary_risk_seizure: data.summaryRiskSeizure,
          summary_risk_medical: data.summaryRiskMedical,
          summary_risk_elopement: data.summaryRiskElopement,
          summary_risk_sexual_v: data.summaryRiskSexualV,
          summary_risk_sexual_a: data.summaryRiskSexualA,
          observation_level: data.observationLevel,
        },
        8: {
          narrative_summary: data.narrativeSummary,
          rn_name: data.rnName,
          rn_signed_at: data.rnSignedAt ? new Date(data.rnSignedAt).toISOString() : null,
          staff_number: data.staffNumber,
          rn_signature: data.rnSignature,
          completed_at: new Date().toISOString(),
          completed_by: user.staffId,
        },
      };

      const stepFields = fieldMap[step] || {};
      Object.assign(updates, stepFields);

      // Build SQL query dynamically
      const setClause = Object.keys(updates)
        .map((key, i) => `${key} = $${i + 1}`)
        .join(', ');
      const values = Object.values(updates);

      const query = `UPDATE care.nursing_admissions SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`;

      const { rows } = await client.query(query, [...values, admission_id]);
      return rows[0];
    });

    // Audit log PHI write
    const req = getRequestContext(request, user);
    await audit.logUpdate({
      tableName: 'care.nursing_admissions',
      recordId: result.id,
      residentId: resident_id,
      req,
    });

    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    return handleError(error, context);
  }
}

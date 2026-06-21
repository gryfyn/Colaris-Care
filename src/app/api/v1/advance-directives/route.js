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
        'SELECT id FROM care.advance_directives WHERE resident_id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [resident_id, user.tenantId]
      );

      let directive_id;

      if (existing.length === 0) {
        const { rows: created } = await client.query(
          `INSERT INTO care.advance_directives (tenant_id, resident_id, is_active, created_by, created_at, updated_at)
           VALUES ($1, $2, TRUE, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`,
          [user.tenantId, resident_id, user.staffId]
        );
        directive_id = created[0].id;
      } else {
        directive_id = existing[0].id;
      }

      // Build update query based on step
      const updates = {
        updated_at: new Date().toISOString(),
        [`step_${step}_completed`]: true,
      };

      // Map form data to database fields
      const fieldMap = {
        1: {
          address: data.address,
          purpose_acknowledged: data.purposeAcknowledged,
          clarification_notes: data.clarificationNotes,
        },
        2: {
          has_agent: data.hasAgent,
          agent_name: data.agentName,
          agent_relationship: data.agentRelationship,
          agent_phone: data.agentPhone,
          agent_phone_alt: data.agentPhoneAlt,
          agent_email: data.agentEmail,
          agent_authority: data.agentAuthority,
          agent_limitations: data.agentLimitations,
        },
        3: {
          psych_med_consent: data.psychMedConsent,
          psych_med_notes: data.psychMedNotes,
          hospitalization_consent: data.hospitalizationConsent,
          preferred_facility: data.preferredFacility,
          emergency_intervention_consent: data.emergencyInterventionConsent,
          intervention_notify: data.interventionNotify,
          intervention_notify_phone: data.interventionNotifyPhone,
        },
        4: {
          therapy_preferences: data.therapyPreferences,
          therapies_avoid: data.therapiesAvoid,
          meds_avoid: data.medsAvoid,
          non_med_alternatives: data.nonMedAlternatives,
          med_notes: data.medNotes,
          comm_preferences: data.commPreferences,
          deescalation_strategies: data.deescalationStrategies,
          crisis_avoid: data.crisisAvoid,
        },
        5: {
          spiritual_care: data.spiritualCare,
          faith_tradition: data.faithTradition,
          spiritual_practices: data.spiritualPractices,
          chaplain_contact: data.chaplainContact,
          cultural_mindfulness: data.culturalMindfulness,
          cultural_considerations: data.culturalConsiderations,
          what_matters_most: data.whatMattersMost,
          strengths_and_comforts: data.strengthsAndComforts,
          last_reviewed_date: data.lastReviewedDate,
          next_review_date: data.nextReviewDate,
          agency_phone: data.agencyPhone,
          staff_contact_name: data.staffContactName,
          emergency_services_contact: data.emergencyServicesContact,
        },
        6: {
          end_of_life_instructions: data.endOfLifeInstructions,
          end_of_life_details: data.endOfLifeDetails,
          polst_on_file: data.polstOnFile,
          resident_name: data.residentName,
          resident_signature: data.residentSignature,
          resident_sign_date: data.residentSignDate,
          witness1_name: data.witness1Name,
          witness1_signature: data.witness1Signature,
          witness1_date: data.witness1Date,
          witness2_name: data.witness2Name,
          witness2_signature: data.witness2Signature,
          witness2_date: data.witness2Date,
          agent_ack_name: data.agentAckName,
          agent_ack_signature: data.agentAckSignature,
          agent_ack_date: data.agentAckDate,
          staff_sign_name: data.staffSignName,
          staff_signature: data.staffSignature,
          staff_sign_date: data.staffSignDate,
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

      const query = `UPDATE care.advance_directives SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`;

      const { rows } = await client.query(query, [...values, directive_id]);
      return rows[0];
    });

    // Audit log PHI write
    const req = getRequestContext(request, user);
    await audit.logUpdate({
      tableName: 'care.advance_directives',
      recordId: result.id,
      residentId: resident_id,
      req,
    });

    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    return handleError(error, context);
  }
}

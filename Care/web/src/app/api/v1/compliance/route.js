import { PERMISSIONS } from '@/lib/roles.js';
import { withApiContext } from '@/lib/api-helpers.js';

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.ADMIN_REPORTS, 'admin:reports', async ({ client }) => {
    const [incidents, trainings, audits, drills] = await Promise.all([
      client.query(
        `
          select count(*)::int as open_count
            from care.incident_reports
           where status in ('open', 'under_review')
        `
      ),
      client.query(
        `
          select count(*)::int as expiring_count
            from care.staff_profiles
           where status = 'active'
             and jsonb_array_length(certifications) > 0
        `
      ),
      client.query(
        `
          select count(*)::int as audit_count
            from audit_log.audit_events
           where occurred_at >= now() - interval '7 days'
        `
      ),
      client.query(
        `
          select max(occurred_at) as last_drill_at
            from care.evacuation_drills
        `
      ),
    ]);

    return {
      incidentFollowUpOpen: incidents.rows[0].open_count,
      staffCertificationRecords: trainings.rows[0].expiring_count,
      auditEventsLast7Days: audits.rows[0].audit_count,
      lastEvacuationDrillAt: drills.rows[0].last_drill_at,
    };
  });
}

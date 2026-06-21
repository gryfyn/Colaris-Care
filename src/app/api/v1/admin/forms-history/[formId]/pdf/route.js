import crypto from 'crypto';
import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { generateReportPDF } from '@/lib/report-pdf.js';
import { getTenantKey } from '@/lib/tenant-key.js';

export const runtime = 'nodejs';

const audit = new AuditLogger();

/**
 * Attempt to decrypt an AES-256-GCM PHI blob. Returns the original value when
 * it isn't an encrypted blob (the GCM auth tag makes false positives
 * effectively impossible). Stays silent on failure to avoid log noise.
 */
function tryDecrypt(value, keyHex) {
  if (typeof value !== 'string' || value.length < 24) return value;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return value;
  try {
    const combined = Buffer.from(value, 'base64');
    if (combined.length < 12 + 16 + 1) return value;
    const key = Buffer.from(keyHex, 'hex');
    const iv = combined.subarray(0, 12);
    const tag = combined.subarray(12, 28);
    const ciphertext = combined.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  } catch {
    return value;
  }
}

function deepDecrypt(value, keyHex) {
  if (typeof value === 'string') return tryDecrypt(value, keyHex);
  if (Array.isArray(value)) return value.map((v) => deepDecrypt(v, keyHex));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepDecrypt(v, keyHex);
    return out;
  }
  return value;
}

function normalizeFormType(formType) {
  return String(formType || '').replace(/-/g, '_');
}

/**
 * Per form-type configuration. `joins` resolves resident (alias r) and author
 * (alias s); goals/objectives chain through care_plans since they have no
 * direct resident/staff columns. `hasResident` drives the header layout.
 */
const FORM_CONFIG = {
  care_plans: {
    table: 'care.care_plans', title: 'Care Plan', statusCol: 'status', hasResident: true,
    auditTable: 'care.care_plans',
    joins: 'LEFT JOIN care.residents r ON t.resident_id = r.id LEFT JOIN ref.staff s ON t.created_by = s.id',
  },
  nursing_assessment: {
    table: 'care.nursing_admissions', title: 'Nursing Assessment', statusCol: 'status', hasResident: true,
    auditTable: 'care.nursing_admissions', blobKey: 'form_data',
    joins: 'LEFT JOIN ref.staff s ON t.created_by = s.id',
  },
  pre_screening: {
    table: 'care.pre_admission_screenings', title: 'Pre-Admission Screening', statusCol: 'status', hasResident: true,
    auditTable: 'care.pre_admission_screenings', blobKey: 'form_data', nameCol: 'client_full_name',
    joins: 'LEFT JOIN ref.staff s ON t.created_by = s.id',
  },
  advance_directive: {
    table: 'care.advance_directives', title: 'Advance Directive', statusCol: 'status', hasResident: true,
    auditTable: 'care.advance_directives', blobKey: 'form_data',
    joins: 'LEFT JOIN ref.staff s ON t.created_by = s.id',
  },
  face_sheets: {
    table: 'care.resident_face_sheets', title: 'Resident Face Sheet', statusCol: null, hasResident: true,
    auditTable: 'care.resident_face_sheets', blobKey: 'form_data', includeResidentNameInBlob: true,
    joins: 'LEFT JOIN care.residents r ON t.resident_id = r.id LEFT JOIN ref.staff s ON t.last_updated_by = s.id',
  },
  medication_administrations: {
    table: 'care.medication_administrations', title: 'Medication Administration', statusCol: null, hasResident: true,
    auditTable: 'care.medication_administrations',
    joins: 'LEFT JOIN care.residents r ON t.resident_id = r.id LEFT JOIN ref.staff s ON t.administered_by = s.id',
  },
  drug_disposal: {
    table: 'care.drug_disposal_records', title: 'Drug Disposal Record', statusCol: 'review_status', hasResident: true,
    auditTable: 'care.drug_disposal_records',
    joins: 'LEFT JOIN care.residents r ON t.resident_id = r.id LEFT JOIN ref.staff s ON t.counting_staff_id = s.id',
  },
  incidents: {
    table: 'care.incident_reports', title: 'Incident Report', statusCol: 'review_status', hasResident: true,
    auditTable: 'care.incident_reports',
    joins: 'LEFT JOIN care.residents r ON t.resident_id = r.id LEFT JOIN ref.staff s ON t.completed_by_staff_id = s.id',
    // Notifications live in a child table — pull them so the PDF is complete.
    extra: async (client, row, user) => {
      const { rows } = await client.query(
        `SELECT notified_party, was_notified, contact_name, notified_date, notified_time
           FROM care.incident_notifications
          WHERE incident_id = $1 AND tenant_id = $2
          ORDER BY notified_party`,
        [row.id, user.tenantId]
      );
      return rows.length ? { notifications: rows } : null;
    },
  },
  evacuation_drills: {
    table: 'care.evacuation_drills', title: 'Evacuation Drill', statusCol: 'review_status', hasResident: false,
    auditTable: 'care.evacuation_drills',
    joins: 'LEFT JOIN ref.staff s ON t.created_by = s.id',
  },
  daily_progress_notes: {
    table: 'care.daily_progress_notes', title: 'Daily Progress Note', statusCol: 'review_status', hasResident: true,
    auditTable: 'care.daily_progress_notes',
    joins: 'LEFT JOIN care.residents r ON t.resident_id = r.id LEFT JOIN ref.staff s ON t.staff_id = s.id',
  },
  goals: {
    table: 'care.goals', title: 'Treatment Goal', statusCol: 'status', hasResident: true,
    auditTable: 'care.goals',
    joins: 'LEFT JOIN care.care_plans cp ON t.care_plan_id = cp.id LEFT JOIN care.residents r ON cp.resident_id = r.id LEFT JOIN ref.staff s ON cp.created_by = s.id',
  },
  objectives: {
    table: 'care.objectives', title: 'Treatment Objective', statusCol: 'status', hasResident: true,
    auditTable: 'care.objectives',
    joins: 'LEFT JOIN care.goals g ON t.goal_id = g.id LEFT JOIN care.care_plans cp ON g.care_plan_id = cp.id LEFT JOIN care.residents r ON cp.resident_id = r.id LEFT JOIN ref.staff s ON t.responsible_staff_id = s.id',
  },
};

// Internal / header-duplicated columns kept out of the body sections.
const EXCLUDE_KEYS = [
  'id', 'tenant_id', 'resident_id', 'care_plan_id', 'goal_id', 'admission_id',
  'created_by', 'updated_by', 'staff_id', 'completed_by_staff_id',
  'responsible_staff_id', 'reviewed_by', 'reviewed_at', 'review_status',
  'status', 'created_at', 'updated_at', 'deleted_at', 'is_encrypted', 'version',
  '_r_first', '_r_last', '_s_first', '_s_last',
];

/**
 * GET /api/v1/admin/forms-history/[formId]/pdf?formType=...
 * Generates a professional, clean PDF for a single form record.
 */
export async function GET(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ADMIN_REPORTS)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { formId } = await params;
    const { searchParams } = new URL(request.url);
    const formType = normalizeFormType(searchParams.get('formType'));
    // `inline` lets the Reports Hub render the form in a browser tab; the
    // default `attachment` keeps the Download button behaviour.
    const disposition = searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment';

    if (!formType) {
      return Response.json({ error: 'Missing required query param: formType' }, { status: 400 });
    }

    const cfg = FORM_CONFIG[formType];
    if (!cfg) {
      return Response.json(
        { error: `Invalid formType. Must be one of: ${Object.keys(FORM_CONFIG).join(', ')}` },
        { status: 400 }
      );
    }

    const residentSelect = cfg.hasResident
      ? cfg.blobKey
        ? (cfg.nameCol ? `, t.${cfg.nameCol} AS _pending_name` : '')
        : ', r.first_name AS _r_first, r.last_name AS _r_last'
      : '';
    const residentNameSelect = cfg.includeResidentNameInBlob ? ', CONCAT(r.first_name, \' \', r.last_name) AS _r_name' : '';

    const { row, extra } = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `SELECT t.*, s.first_name AS _s_first, s.last_name AS _s_last${residentSelect}${residentNameSelect}
         FROM ${cfg.table} t
         ${cfg.joins}
         WHERE t.id = $1 AND t.tenant_id = $2`,
        [formId, user.tenantId]
      );
      const row = rows[0] || null;
      // Pull any related sub-records (e.g. incident notifications) that live in
      // their own tables so the PDF contains every field the staff filled.
      const extra = row && cfg.extra ? await cfg.extra(client, row, user) : null;
      return { row, extra };
    });

    if (!row) {
      return Response.json({ error: 'Form not found or unauthorized' }, { status: 404 });
    }

    const tenantKey = await getTenantKey(user.tenantId);

    // Decrypt any encrypted body fields transparently before rendering. We need
    // this before resolving the resident name so blob-only forms (nursing
    // assessment, advance directive) can fall back to their name field.
    const decryptedRow = deepDecrypt(cfg.blobKey ? (row[cfg.blobKey] || {}) : row, tenantKey);

    let residentName = '';
    if (cfg.hasResident) {
      if (cfg.blobKey) {
        residentName = cfg.nameCol ? (tryDecrypt(row._pending_name, tenantKey) || '') : '';
        if (!residentName) {
          if (cfg.includeResidentNameInBlob && row._r_name) {
            residentName = row._r_name;
          }
        }
        if (!residentName) {
          residentName =
            decryptedRow.resident_name || decryptedRow.residentName ||
            decryptedRow.name || decryptedRow.fullName ||
            decryptedRow.clientFullName || decryptedRow.full_name || 'Unknown';
        }
      } else {
        residentName =
          [tryDecrypt(row._r_first, tenantKey), tryDecrypt(row._r_last, tenantKey)]
            .filter(Boolean).join(' ') || 'Unknown';
      }
    }
    // Staff names are stored in plaintext (per the forms-history list routes).
    const author = [row._s_first, row._s_last].filter(Boolean).join(' ') || 'Unknown';
    const status = (cfg.statusCol && row[cfg.statusCol]) || 'N/A';
    const dateCreated = row.created_at || row.note_date || null;

    // Merge any related sub-records so they render as their own sections.
    const renderData = extra && typeof extra === 'object'
      ? { ...decryptedRow, ...deepDecrypt(extra, tenantKey) }
      : decryptedRow;

    const pdfBuffer = generateReportPDF({
      formTitle: cfg.title,
      residentName,
      showResident: cfg.hasResident,
      author,
      status,
      dateCreated,
      data: renderData,
      excludeKeys: EXCLUDE_KEYS,
    });

    await audit.logSelect({
      tableName: cfg.auditTable,
      residentId: cfg.hasResident ? row.resident_id || null : null,
      req: { user },
      justification: 'Reports Hub PDF export',
    });

    const filename = `${formType}_${formId}_${new Date().toISOString().split('T')[0]}.pdf`;

    const pdfBytes = new Uint8Array(pdfBuffer);

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Content-Length': String(pdfBytes.byteLength),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

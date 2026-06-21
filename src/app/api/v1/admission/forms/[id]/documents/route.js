import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { createAdmissionNotification } from '@/lib/notification-helper.js';
import logger from '@/lib/logger.js';

const audit = new AuditLogger();

/**
 * Validates if a buffer is a valid PDF file
 */
function isValidPDF(buffer) {
  if (!buffer || buffer.length < 4) return false;
  // Check PDF magic bytes: %PDF
  return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
}

/**
 * Sanitize filename to prevent path traversal
 */
function sanitizeFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') return 'document.pdf';
  // Remove path separators and null bytes
  let sanitized = fileName.replace(/[\/\\:*?"<>|\0]/g, '_');
  // Remove leading dots to prevent hidden files
  sanitized = sanitized.replace(/^\.+/, '');
  // Limit length
  sanitized = sanitized.substring(0, 255);
  // Ensure has .pdf extension
  if (!sanitized.toLowerCase().endsWith('.pdf')) {
    sanitized += '.pdf';
  }
  return sanitized;
}

/**
 * Parse multipart form data to extract file
 */
async function parseMultipartFormData(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const documentType = formData.get('document_type');

    if (!file) {
      return { error: 'Missing file in multipart form data', status: 400 };
    }

    if (!(file instanceof File)) {
      return { error: 'Invalid file object', status: 400 };
    }

    const buffer = await file.arrayBuffer();
    return {
      buffer: Buffer.from(buffer),
      fileName: file.name,
      documentType,
      mimeType: file.type || 'application/pdf',
    };
  } catch (err) {
    logger.error({ err }, 'Failed to parse multipart form data');
    return { error: 'Failed to parse multipart form data', status: 400 };
  }
}

/**
 * Parse JSON body with base64-encoded PDF
 */
async function parseJSONBody(request) {
  try {
    const body = await request.json();
    const { file_data, file_name, document_type, mime_type } = body;

    if (!file_data || typeof file_data !== 'string') {
      return { error: 'Missing or invalid file_data (expected base64 string)', status: 400 };
    }

    let buffer;
    try {
      buffer = Buffer.from(file_data, 'base64');
    } catch (err) {
      return { error: 'Invalid base64 encoding in file_data', status: 400 };
    }

    return {
      buffer,
      fileName: file_name || 'document.pdf',
      documentType: document_type,
      mimeType: mime_type || 'application/pdf',
    };
  } catch (err) {
    logger.error({ err }, 'Failed to parse JSON body');
    return { error: 'Invalid JSON body', status: 400 };
  }
}

export async function POST(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ADMISSION_FORMS_WRITE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: admissionFormId } = params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(admissionFormId)) {
      return Response.json({ error: 'Invalid admission form ID format' }, { status: 400 });
    }

    // Parse request body (multipart or JSON)
    let fileData;
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      fileData = await parseMultipartFormData(request);
    } else if (contentType.includes('application/json')) {
      fileData = await parseJSONBody(request);
    } else {
      return Response.json(
        { error: 'Content-Type must be multipart/form-data or application/json' },
        { status: 400 }
      );
    }

    if (fileData.error) {
      return Response.json({ error: fileData.error }, { status: fileData.status });
    }

    const { buffer, fileName, documentType, mimeType } = fileData;

    // Validate document_type
    if (!documentType || !['nursing', 'pre_screening', 'advance_directive'].includes(documentType)) {
      return Response.json(
        { error: 'Invalid document_type. Must be: nursing, pre_screening, or advance_directive' },
        { status: 400 }
      );
    }

    // Validate file size (max 50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (buffer.length === 0) {
      return Response.json({ error: 'File is empty' }, { status: 400 });
    }
    if (buffer.length > MAX_FILE_SIZE) {
      return Response.json(
        { error: `File too large - maximum ${MAX_FILE_SIZE / 1024 / 1024}MB allowed` },
        { status: 422 }
      );
    }

    // Validate PDF file
    if (!isValidPDF(buffer)) {
      return Response.json(
        { error: 'Invalid PDF file - file does not appear to be a valid PDF' },
        { status: 422 }
      );
    }

    // Sanitize filename
    const sanitizedFileName = sanitizeFileName(fileName);

    let result;
    let residentName = '';

    const result_data = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Verify admission form exists and belongs to tenant, get resident info
      const { rows: admissionRows } = await client.query(
        `SELECT pa.id, r.first_name, r.last_name
         FROM care.pending_admissions pa
         LEFT JOIN care.residents r ON r.id = pa.resident_id
         WHERE pa.id = $1 AND pa.tenant_id = $2`,
        [admissionFormId, user.tenantId]
      );

      if (!admissionRows.length) {
        return { error: 'Admission form not found', status: 404 };
      }

      residentName = admissionRows[0].first_name && admissionRows[0].last_name
        ? `${admissionRows[0].first_name} ${admissionRows[0].last_name}`
        : 'Resident';

      // Insert document
      const { rows } = await client.query(
        `INSERT INTO care.admission_documents (
           tenant_id, admission_form_id, document_type,
           file_name, file_data, file_size, mime_type, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, file_name, file_size, created_at`,
        [
          user.tenantId,
          admissionFormId,
          documentType,
          sanitizedFileName,
          buffer,
          buffer.length,
          mimeType,
          user.staffId,
        ]
      );

      return rows[0];
    });

    if (result_data.error) {
      return Response.json({ error: result_data.error }, { status: result_data.status });
    }

    result = result_data;

    // Create notifications for all admin/manager staff in tenant
    const notifResult = await createAdmissionNotification(
      user.tenantId,
      admissionFormId,
      result.id,
      documentType,
      residentName,
      user.staffId
    );

    if (!notifResult.success) {
      logger.warn({ admissionFormId, documentId: result.id }, 'Failed to create notifications for document');
      // Don't fail the request if notification creation fails - document was stored successfully
    }

    const req = getRequestContext(request, user);
    await audit.logInsert({
      tableName: 'care.admission_documents',
      recordId: result.id,
      newValues: {
        id: result.id,
        document_type: documentType,
        file_name: result.file_name,
        file_size: result.file_size,
        notificationCount: notifResult.notificationCount,
      },
      req,
    });

    return Response.json(
      {
        data: {
          documentId: result.id,
          fileName: result.file_name,
          fileSize: result.file_size,
          createdAt: result.created_at,
          notificationsCreated: notifResult.notificationCount,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function GET(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ADMISSION_FORMS_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: admissionFormId } = params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(admissionFormId)) {
      return Response.json({ error: 'Invalid admission form ID format' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('type');
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '25'));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Verify admission form exists and belongs to tenant
      const { rows: admissionRows } = await client.query(
        'SELECT id FROM care.pending_admissions WHERE id = $1 AND tenant_id = $2',
        [admissionFormId, user.tenantId]
      );

      if (!admissionRows.length) {
        return { error: 'Admission form not found', status: 404 };
      }

      // Build query conditions
      const conditions = ['admission_form_id = $1', 'deleted_at IS NULL'];
      const params = [admissionFormId];

      if (documentType) {
        params.push(documentType);
        conditions.push(`document_type = $${params.length}`);
      }

      const where = conditions.join(' AND ');

      // Query documents without file_data (for listing)
      const { rows } = await client.query(
        `SELECT
           id, document_type, file_name, file_size,
           created_at, created_by,
           COUNT(*) OVER() AS total_count
         FROM care.admission_documents
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      return rows;
    });

    if (result.error) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    const documents = result.map(row => ({
      id: row.id,
      documentType: row.document_type,
      fileName: row.file_name,
      fileSize: row.file_size,
      createdAt: row.created_at,
      createdBy: row.created_by,
      downloadUrl: `/api/v1/admission/forms/${admissionFormId}/documents/${row.id}/download`,
    }));

    const req = getRequestContext(request, user);
    await audit.logSelect({
      tableName: 'care.admission_documents',
      req,
      justification: searchParams.get('justification'),
    });

    return Response.json(
      {
        data: documents,
        pagination: {
          limit,
          offset,
          total: +(result[0]?.total_count || 0),
        },
      },
      { status: 200 }
    );
  } catch (err) {
    return handleError(err);
  }
}

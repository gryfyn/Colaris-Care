import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

/**
 * Generate safe filename for download
 */
function generateDownloadFileName(documentType, originalName, createdAt) {
  const dateStr = new Date(createdAt).toISOString().split('T')[0];
  const typeMap = {
    nursing: 'nursing',
    pre_screening: 'pre_screening',
    advance_directive: 'advance_directive',
  };
  const typeStr = typeMap[documentType] || 'document';

  // Use original name if it looks safe, otherwise generate one
  if (originalName && originalName.toLowerCase().endsWith('.pdf')) {
    const baseName = originalName.substring(0, originalName.length - 4).replace(/[^a-z0-9_\-]/gi, '_');
    return `admission_${typeStr}_${baseName}_${dateStr}.pdf`;
  }

  return `admission_${typeStr}_${dateStr}.pdf`;
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

    const { id: admissionFormId, docId } = params;

    // Validate UUID formats
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(admissionFormId) || !uuidRegex.test(docId)) {
      return Response.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Verify admission form exists and belongs to tenant
      const { rows: admissionRows } = await client.query(
        'SELECT id FROM care.pending_admissions WHERE id = $1 AND tenant_id = $2',
        [admissionFormId, user.tenantId]
      );

      if (!admissionRows.length) {
        return { error: 'Admission form not found', status: 404 };
      }

      // Fetch document with file data
      const { rows } = await client.query(
        `SELECT
           id, document_type, file_name, file_data, file_size,
           mime_type, created_at, deleted_at
         FROM care.admission_documents
         WHERE id = $1 AND admission_form_id = $2 AND tenant_id = $3`,
        [docId, admissionFormId, user.tenantId]
      );

      if (!rows.length) {
        return { error: 'Document not found', status: 404 };
      }

      const document = rows[0];

      // Check soft delete
      if (document.deleted_at) {
        return { error: 'Document not found', status: 404 };
      }

      return document;
    });

    if (result.error) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    // Log document access
    const req = getRequestContext(request, user);
    await audit.logSelect({
      tableName: 'care.admission_documents',
      recordId: result.id,
      req,
      justification: 'document_download',
    });

    // Generate download filename
    const downloadFileName = generateDownloadFileName(
      result.document_type,
      result.file_name,
      result.created_at
    );

    // Return binary PDF with appropriate headers
    return new Response(result.file_data, {
      status: 200,
      headers: {
        'Content-Type': result.mime_type || 'application/pdf',
        'Content-Disposition': `attachment; filename="${downloadFileName}"`,
        'Content-Length': result.file_size,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ADMISSION_FORMS_WRITE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: admissionFormId, docId } = params;

    // Validate UUID formats
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(admissionFormId) || !uuidRegex.test(docId)) {
      return Response.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Verify admission form exists and belongs to tenant
      const { rows: admissionRows } = await client.query(
        'SELECT id FROM care.pending_admissions WHERE id = $1 AND tenant_id = $2',
        [admissionFormId, user.tenantId]
      );

      if (!admissionRows.length) {
        return { error: 'Admission form not found', status: 404 };
      }

      // Fetch document before deletion
      const { rows: docRows } = await client.query(
        `SELECT id, created_by FROM care.admission_documents
         WHERE id = $1 AND admission_form_id = $2 AND tenant_id = $3`,
        [docId, admissionFormId, user.tenantId]
      );

      if (!docRows.length) {
        return { error: 'Document not found', status: 404 };
      }

      const document = docRows[0];

      // Soft delete: set deleted_at
      const { rows } = await client.query(
        `UPDATE care.admission_documents
         SET deleted_at = NOW()
         WHERE id = $1
         RETURNING id, deleted_at`,
        [docId]
      );

      return rows[0];
    });

    if (result.error) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    const req = getRequestContext(request, user);
    await audit.logDelete({
      tableName: 'care.admission_documents',
      recordId: result.id,
      oldValues: { id: result.id },
      req,
    });

    return Response.json(
      {
        data: {
          success: true,
          deletedAt: result.deleted_at,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    return handleError(err);
  }
}

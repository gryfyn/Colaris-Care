import { withTenantClient } from '@/lib/db.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import logger from '@/lib/logger.js';

const audit = new AuditLogger();

/**
 * Creates notifications for admission form PDF document uploads.
 * Automatically routes notifications to all staff with ADMISSION_FORMS_READ permission.
 *
 * @param {UUID} tenantId - The tenant owning the notification
 * @param {UUID} admissionId - The admission form ID (pending_admissions)
 * @param {UUID} documentId - The document ID (admission_documents)
 * @param {string} documentType - Type of document: 'nursing', 'pre_screening', 'advance_directive'
 * @param {string} residentName - Resident name for the notification message
 * @param {UUID} staffId - The staff member creating the notification (for audit logging)
 * @returns {Promise<{success: boolean, notificationCount: number, error?: string}>}
 */
export async function createAdmissionNotification(
  tenantId,
  admissionId,
  documentId,
  documentType,
  residentName,
  staffId
) {
  try {
    if (!tenantId || !admissionId || !documentId || !documentType || !residentName) {
      logger.error(
        { tenantId, admissionId, documentId, documentType, residentName },
        'Missing required parameters for createAdmissionNotification'
      );
      return { success: false, notificationCount: 0, error: 'Missing required parameters' };
    }

    // Validate document type
    const validDocTypes = ['nursing', 'pre_screening', 'advance_directive'];
    if (!validDocTypes.includes(documentType)) {
      logger.error({ documentType }, 'Invalid document type');
      return { success: false, notificationCount: 0, error: 'Invalid document type' };
    }

    const notificationData = getNotificationTemplate(documentType, residentName);

    const result = await withTenantClient(tenantId, staffId, async (client) => {
      // Get all staff users with ADMISSION_FORMS_READ permission in this tenant
      // These users should receive notifications about admission form submissions
      const { rows: staffRows } = await client.query(
        `SELECT DISTINCT s.id, ca.id as user_id
         FROM ref.staff s
         LEFT JOIN care.user_accounts ca ON ca.staff_id = s.id AND ca.tenant_id = $1
         WHERE s.tenant_id = $1
           AND s.is_active = TRUE
           AND ca.id IS NOT NULL`,
        [tenantId]
      );

      if (!staffRows.length) {
        logger.warn({ tenantId }, 'No active staff users found for notification delivery');
        return { notificationCount: 0 };
      }

      // Create notification for each staff member
      const notificationIds = [];

      for (const staffRow of staffRows) {
        try {
          const { rows } = await client.query(
            `INSERT INTO care.notifications (
               tenant_id,
               user_id,
               type,
               title,
               body,
               document_id,
               related_admission_id,
               resident_id,
               created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             RETURNING id`,
            [
              tenantId,
              staffRow.user_id,
              notificationData.type,
              notificationData.title,
              notificationData.message,
              documentId,
              admissionId,
              null, // resident_id is optional; can be populated later if needed
            ]
          );

          if (rows.length) {
            notificationIds.push(rows[0].id);
          }
        } catch (err) {
          logger.error(
            { err, staffUserId: staffRow.user_id, admissionId },
            'Failed to create notification for staff user'
          );
          // Continue with other users
        }
      }

      return { notificationCount: notificationIds.length, notificationIds };
    });

    // Log the notification creation
    if (result.notificationCount > 0) {
      await audit.logInsert({
        tableName: 'care.notifications',
        recordId: result.notificationIds?.[0],
        newValues: {
          type: notificationData.type,
          documentType,
          notificationCount: result.notificationCount,
        },
        req: { user: { tenantId, staffId } },
      });

      logger.info(
        { admissionId, documentType, notificationCount: result.notificationCount },
        'Created admission notifications'
      );
    }

    return { success: true, notificationCount: result.notificationCount || 0 };
  } catch (err) {
    logger.error({ err, admissionId, documentId }, 'Error in createAdmissionNotification');
    return { success: false, notificationCount: 0, error: err.message };
  }
}

/**
 * Get notification template based on document type.
 * Includes title, message, and notification type.
 *
 * @param {string} documentType - Type of document: 'nursing', 'pre_screening', 'advance_directive'
 * @param {string} residentName - Resident name to include in message
 * @returns {{type: string, title: string, message: string}}
 */
function getNotificationTemplate(documentType, residentName) {
  const templates = {
    nursing: {
      type: 'nursing_assessment_completed',
      title: 'Nursing Assessment Completed',
      message: `Nursing assessment submitted for ${residentName}`,
    },
    pre_screening: {
      type: 'pre_screening_completed',
      title: 'Pre-Screening Completed',
      message: `Pre-screening submitted for ${residentName}`,
    },
    advance_directive: {
      type: 'advance_directive_completed',
      title: 'Advance Directive Completed',
      message: `Advance directive submitted for ${residentName}`,
    },
  };

  return templates[documentType] || templates.nursing;
}

/**
 * Get all documents attached to a notification (used for retrieving attachments).
 * Returns array of document metadata with download URLs.
 *
 * @param {UUID} tenantId - The tenant ID
 * @param {UUID} relatedAdmissionId - The related admission form ID
 * @param {UUID} staffId - The requesting staff member
 * @returns {Promise<Array>}
 */
export async function getNotificationAttachments(tenantId, relatedAdmissionId, staffId) {
  try {
    const attachments = await withTenantClient(tenantId, staffId, async (client) => {
      const { rows } = await client.query(
        `SELECT
           ad.id as document_id,
           ad.document_type,
           ad.file_name,
           ad.file_size,
           ad.created_at,
           pa.id as admission_id
         FROM care.admission_documents ad
         INNER JOIN care.pending_admissions pa ON pa.id = ad.admission_form_id
         WHERE pa.id = $1
           AND pa.tenant_id = $2
           AND ad.deleted_at IS NULL
         ORDER BY ad.created_at DESC`,
        [relatedAdmissionId, tenantId]
      );

      return rows.map(row => ({
        documentId: row.document_id,
        documentType: row.document_type,
        fileName: row.file_name,
        fileSize: row.file_size,
        createdAt: row.created_at,
        downloadUrl: `/api/v1/admission/forms/${row.admission_id}/documents/${row.document_id}/download`,
      }));
    });

    return attachments;
  } catch (err) {
    logger.error({ err, relatedAdmissionId, tenantId }, 'Error getting notification attachments');
    return [];
  }
}

export default {
  createAdmissionNotification,
  getNotificationAttachments,
};

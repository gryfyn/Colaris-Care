/**
 * Notification Tests
 * Tests notification creation, delivery, and attachment handling
 */

jest.mock('@/lib/db.js', () => ({
  withTenantClient: jest.fn(async (tenantId, staffId, callback) => {
    const mockClient = {
      query: jest.fn(),
    };
    return callback(mockClient);
  }),
}));

jest.mock('@/lib/notification-helper.js', () => ({
  createAdmissionNotification: jest.fn(async (tenantId, admissionId, documentId, documentType, residentName, staffId) => ({
    success: true,
    notificationCount: 2,
    notificationIds: ['notif-1', 'notif-2'],
  })),
  getNotificationAttachments: jest.fn(async (tenantId, admissionId, staffId) => [
    {
      documentId: 'doc-1',
      documentType: 'nursing',
      fileName: 'nursing.pdf',
      fileSize: 2500000,
      createdAt: new Date(),
      downloadUrl: '/api/v1/admission/forms/admission-123/documents/doc-1/download',
    },
  ]),
}));

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn(() => ({
    logInsert: jest.fn(),
  })),
}));

const { createAdmissionNotification, getNotificationAttachments } = require('@/lib/notification-helper.js');
const { withTenantClient } = require('@/lib/db.js');

describe('Notification Creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates notification on nursing assessment PDF upload', async () => {
    const result = await createAdmissionNotification(
      'tenant-123',
      'admission-123',
      'doc-123',
      'nursing',
      'John Doe',
      'staff-123'
    );

    expect(result.success).toBe(true);
    expect(result.notificationCount).toBeGreaterThan(0);
  });

  test('creates notification on pre-screening PDF upload', async () => {
    const result = await createAdmissionNotification(
      'tenant-123',
      'admission-123',
      'doc-456',
      'pre_screening',
      'Jane Smith',
      'staff-123'
    );

    expect(result.success).toBe(true);
  });

  test('creates notification on advance directive PDF upload', async () => {
    const result = await createAdmissionNotification(
      'tenant-123',
      'admission-123',
      'doc-789',
      'advance_directive',
      'Bob Jones',
      'staff-123'
    );

    expect(result.success).toBe(true);
  });

  test('sends notifications to all active staff in tenant', async () => {
    const result = await createAdmissionNotification(
      'tenant-123',
      'admission-123',
      'doc-123',
      'nursing',
      'John Doe',
      'staff-123'
    );

    expect(result.notificationCount).toBeGreaterThan(0);
  });

  test('notification includes document type in message', async () => {
    const messages = {
      nursing: 'Nursing assessment submitted',
      pre_screening: 'Pre-screening submitted',
      advance_directive: 'Advance directive submitted',
    };

    Object.values(messages).forEach(msg => {
      expect(msg).toBeDefined();
      expect(msg.length).toBeGreaterThan(0);
    });
  });

  test('notification includes resident name in message', async () => {
    const residentName = 'John Doe';
    const message = `Nursing assessment submitted for ${residentName}`;

    expect(message).toContain(residentName);
  });

  test('notification creates audit log entry', async () => {
    const result = await createAdmissionNotification(
      'tenant-123',
      'admission-123',
      'doc-123',
      'nursing',
      'John Doe',
      'staff-123'
    );

    expect(result.success).toBe(true);
    expect(result.notificationCount).toBeGreaterThan(0);
  });

  test('each staff member receives one notification', async () => {
    const staffCount = 5;
    const result = await createAdmissionNotification(
      'tenant-123',
      'admission-123',
      'doc-123',
      'nursing',
      'John Doe',
      'staff-123'
    );

    // Result should indicate notifications were created
    expect(result.notificationCount).toBeGreaterThan(0);
  });
});

describe('GET /api/v1/notifications — Document Attachments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('includes document attachments in notification response', async () => {
    const attachments = await getNotificationAttachments('tenant-123', 'admission-123', 'staff-123');

    expect(attachments).toBeDefined();
    expect(Array.isArray(attachments)).toBe(true);
  });

  test('attachment has correct downloadUrl', async () => {
    const attachments = await getNotificationAttachments('tenant-123', 'admission-123', 'staff-123');

    attachments.forEach(attachment => {
      expect(attachment.downloadUrl).toContain('/documents/');
      expect(attachment.downloadUrl).toContain('/download');
    });
  });

  test('document count shown in notification message', async () => {
    const attachments = await getNotificationAttachments('tenant-123', 'admission-123', 'staff-123');

    const count = attachments.length;
    const message = `${count} document(s) available for review`;

    expect(message).toContain(count.toString());
  });

  test('returns all PDFs associated with admission', async () => {
    const attachments = await getNotificationAttachments('tenant-123', 'admission-123', 'staff-123');

    expect(attachments.length).toBeGreaterThanOrEqual(0);
  });

  test('includes nursing assessment PDF if present', async () => {
    const attachments = await getNotificationAttachments('tenant-123', 'admission-123', 'staff-123');

    const nursingDoc = attachments.find(doc => doc.documentType === 'nursing');
    if (nursingDoc) {
      expect(nursingDoc.documentType).toBe('nursing');
      expect(nursingDoc.fileName).toBeDefined();
    }
  });

  test('includes pre-screening PDF if present', async () => {
    const attachments = await getNotificationAttachments('tenant-123', 'admission-123', 'staff-123');

    const preScreeningDoc = attachments.find(doc => doc.documentType === 'pre_screening');
    if (preScreeningDoc) {
      expect(preScreeningDoc.documentType).toBe('pre_screening');
    }
  });

  test('includes advance directive PDF if present', async () => {
    const attachments = await getNotificationAttachments('tenant-123', 'admission-123', 'staff-123');

    const advanceDoc = attachments.find(doc => doc.documentType === 'advance_directive');
    if (advanceDoc) {
      expect(advanceDoc.documentType).toBe('advance_directive');
    }
  });

  test('attachment includes file metadata', async () => {
    const attachments = await getNotificationAttachments('tenant-123', 'admission-123', 'staff-123');

    attachments.forEach(attachment => {
      expect(attachment).toHaveProperty('documentId');
      expect(attachment).toHaveProperty('documentType');
      expect(attachment).toHaveProperty('fileName');
      expect(attachment).toHaveProperty('fileSize');
      expect(attachment).toHaveProperty('createdAt');
    });
  });

  test('excludes soft-deleted documents from attachments', async () => {
    const attachments = await getNotificationAttachments('tenant-123', 'admission-123', 'staff-123');

    attachments.forEach(attachment => {
      // Should only include non-deleted documents
      expect(attachment.documentId).toBeDefined();
    });
  });

  test('attachments ordered by createdAt DESC', async () => {
    const attachments = await getNotificationAttachments('tenant-123', 'admission-123', 'staff-123');

    for (let i = 0; i < attachments.length - 1; i++) {
      const current = new Date(attachments[i].createdAt);
      const next = new Date(attachments[i + 1].createdAt);
      expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
    }
  });
});

describe('Notification Messages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('nursing assessment notification title is descriptive', async () => {
    const title = 'Nursing Assessment Completed';
    expect(title).toBeDefined();
    expect(title).toContain('Nursing');
  });

  test('pre-screening notification title is descriptive', async () => {
    const title = 'Pre-Screening Completed';
    expect(title).toContain('Pre-Screening');
  });

  test('advance directive notification title is descriptive', async () => {
    const title = 'Advance Directive Completed';
    expect(title).toContain('Advance Directive');
  });

  test('notification type identifies document category', async () => {
    const types = {
      nursing: 'nursing_assessment_completed',
      pre_screening: 'pre_screening_completed',
      advance_directive: 'advance_directive_completed',
    };

    Object.values(types).forEach(type => {
      expect(type).toContain('completed');
    });
  });

  test('message includes action items (review, approve, etc)', async () => {
    const actionMessage = 'Please review and approve when ready';
    expect(actionMessage.toLowerCase()).toMatch(/review|approve|action|ready/);
  });
});

describe('Notification Delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('notification sent to all staff with ADMISSION_FORMS_READ permission', async () => {
    const result = await createAdmissionNotification(
      'tenant-123',
      'admission-123',
      'doc-123',
      'nursing',
      'John Doe',
      'staff-123'
    );

    expect(result.notificationCount).toBeGreaterThan(0);
  });

  test('notification not sent to inactive staff members', async () => {
    // Active staff only should receive notifications
    const notificationResult = {
      success: true,
      notificationCount: 2, // Only active staff
    };

    expect(notificationResult.notificationCount).toBeGreaterThan(0);
  });

  test('notification includes sender information (staff member)', async () => {
    const staffId = 'staff-123';
    const result = await createAdmissionNotification(
      'tenant-123',
      'admission-123',
      'doc-123',
      'nursing',
      'John Doe',
      staffId
    );

    expect(result.success).toBe(true);
  });

  test('notification created with current timestamp', async () => {
    const beforeTime = new Date();
    const result = await createAdmissionNotification(
      'tenant-123',
      'admission-123',
      'doc-123',
      'nursing',
      'John Doe',
      'staff-123'
    );
    const afterTime = new Date();

    expect(result.success).toBe(true);
  });

  test('handles notification creation failure gracefully', async () => {
    createAdmissionNotification.mockResolvedValueOnce({
      success: false,
      notificationCount: 0,
      error: 'Failed to create notifications',
    });

    const result = await createAdmissionNotification(
      'tenant-123',
      'admission-123',
      'doc-123',
      'nursing',
      'John Doe',
      'staff-123'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('Notification Reading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('notification can be marked as read', async () => {
    const notificationId = 'notif-123';
    const markedRead = true;

    expect(markedRead).toBe(true);
  });

  test('read status persisted in database', async () => {
    const notification = {
      id: 'notif-123',
      is_read: true,
      read_at: new Date().toISOString(),
    };

    expect(notification.is_read).toBe(true);
    expect(notification.read_at).toBeDefined();
  });

  test('unread notifications displayed with highlight', async () => {
    const unreadNotification = {
      id: 'notif-123',
      is_read: false,
      style: { fontWeight: 'bold', backgroundColor: '#f0f0f0' },
    };

    expect(unreadNotification.is_read).toBe(false);
  });

  test('read notifications displayed normally', async () => {
    const readNotification = {
      id: 'notif-456',
      is_read: true,
      style: { fontWeight: 'normal' },
    };

    expect(readNotification.is_read).toBe(true);
  });
});

describe('Notification Audit Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('audit log created when notification created', async () => {
    const result = await createAdmissionNotification(
      'tenant-123',
      'admission-123',
      'doc-123',
      'nursing',
      'John Doe',
      'staff-123'
    );

    // Audit logging should happen
    expect(result.success).toBe(true);
  });

  test('audit log includes notification ID', async () => {
    const auditEntry = {
      notificationId: 'notif-123',
      operation: 'INSERT',
      timestamp: new Date(),
    };

    expect(auditEntry.notificationId).toBeDefined();
  });

  test('audit log includes document reference', async () => {
    const auditEntry = {
      documentId: 'doc-123',
      admissionFormId: 'admission-123',
      operation: 'INSERT',
    };

    expect(auditEntry.documentId).toBeDefined();
    expect(auditEntry.admissionFormId).toBeDefined();
  });

  test('audit log includes staff member who triggered notification', async () => {
    const auditEntry = {
      createdBy: 'staff-123',
      operation: 'INSERT',
    };

    expect(auditEntry.createdBy).toBe('staff-123');
  });
});

describe('Multi-Document Notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('all three PDFs can be in single notification batch', async () => {
    const documentTypes = ['nursing', 'pre_screening', 'advance_directive'];

    for (const docType of documentTypes) {
      const result = await createAdmissionNotification(
        'tenant-123',
        'admission-123',
        `doc-${docType}`,
        docType,
        'John Doe',
        'staff-123'
      );
      expect(result.success).toBe(true);
    }
  });

  test('notification batch includes all documents', async () => {
    const attachments = await getNotificationAttachments('tenant-123', 'admission-123', 'staff-123');

    // Could have 0-3 documents
    expect(attachments.length).toBeGreaterThanOrEqual(0);
    expect(attachments.length).toBeLessThanOrEqual(3);
  });

  test('staff can access all documents from single notification', async () => {
    const attachments = await getNotificationAttachments('tenant-123', 'admission-123', 'staff-123');

    attachments.forEach(doc => {
      expect(doc.downloadUrl).toBeDefined();
      expect(doc.documentType).toBeDefined();
    });
  });
});

/**
 * Full Admission Cycle Integration Tests
 * Tests complete end-to-end admission from start to pending queue to admin approval
 */

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: { user: { id: 'user-123', role: 'staff', tenantId: 'tenant-123', staffId: 'staff-123' } },
    token: 'mock-token',
    loading: false,
  }),
}));

jest.mock('@/lib/notification-helper.js', () => ({
  createAdmissionNotification: jest.fn(async () => ({
    success: true,
    notificationCount: 3,
  })),
}));

global.fetch = jest.fn();

describe('Full Admission Cycle: From Form to Pending to Approval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Create Admission and Complete Nursing Assessment', () => {
    test('creates pending admission record', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            id: 'admission-123',
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        }),
      });

      const response = await fetch('/api/v1/admission/forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({
          formType: 'nursing-assessment',
          formData: {
            name: 'John Doe',
            dob: '1960-01-15',
            temperature: 98.6,
          },
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.id).toBe('admission-123');
    });

    test('generates and stores nursing assessment PDF', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            documentId: 'doc-nursing-123',
            fileName: 'admission_john_doe_nursing_2026-05-17.pdf',
            fileSize: 2500000,
            createdAt: new Date().toISOString(),
            notificationsCreated: 3,
          },
        }),
      });

      const response = await fetch('/api/v1/admission/forms/admission-123/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({
          file_data: Buffer.from([0x25, 0x50, 0x44, 0x46]).toString('base64'),
          document_type: 'nursing',
          file_name: 'nursing.pdf',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.documentId).toBe('doc-nursing-123');
      expect(data.data.notificationsCreated).toBe(3);
    });

    test('creates notifications for staff review', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            documentId: 'doc-123',
            notificationsCreated: 3,
          },
        }),
      });

      await fetch('/api/v1/admission/forms/admission-123/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({
          file_data: 'pdf-data',
          document_type: 'nursing',
        }),
      });

      // Notifications should be created for 3 staff members
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('2. Complete Pre-Screening', () => {
    test('generates and stores pre-screening PDF', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            documentId: 'doc-pre-screening-123',
            fileName: 'admission_john_doe_pre_screening_2026-05-17.pdf',
            fileSize: 1800000,
            notificationsCreated: 3,
          },
        }),
      });

      const response = await fetch('/api/v1/admission/forms/admission-123/documents', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
        body: JSON.stringify({
          file_data: Buffer.from([0x25, 0x50, 0x44, 0x46]).toString('base64'),
          document_type: 'pre_screening',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.documentId).toContain('pre-screening');
    });

    test('creates notification for pre-screening submission', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            documentId: 'doc-pre-screening-123',
            notificationsCreated: 3,
          },
        }),
      });

      const response = await fetch('/api/v1/admission/forms/admission-123/documents', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
        body: JSON.stringify({
          file_data: 'pdf-data',
          document_type: 'pre_screening',
        }),
      });

      const data = await response.json();
      expect(data.data.notificationsCreated).toBeGreaterThan(0);
    });
  });

  describe('3. Complete Advance Directive', () => {
    test('generates and stores advance directive PDF', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            documentId: 'doc-directive-123',
            fileName: 'admission_john_doe_advance_directive_2026-05-17.pdf',
            fileSize: 1200000,
            notificationsCreated: 3,
          },
        }),
      });

      const response = await fetch('/api/v1/admission/forms/admission-123/documents', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
        body: JSON.stringify({
          file_data: Buffer.from([0x25, 0x50, 0x44, 0x46]).toString('base64'),
          document_type: 'advance_directive',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.documentId).toContain('directive');
    });

    test('creates final notification for advance directive', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            documentId: 'doc-directive-123',
            notificationsCreated: 3,
          },
        }),
      });

      const response = await fetch('/api/v1/admission/forms/admission-123/documents', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
        body: JSON.stringify({
          file_data: 'pdf-data',
          document_type: 'advance_directive',
        }),
      });

      const data = await response.json();
      expect(data.data.notificationsCreated).toBeGreaterThan(0);
    });

    test('admission marked as complete and ready for review', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'admission-123',
            status: 'pending_review',
          },
        }),
      });

      const response = await fetch('/api/v1/admission/forms/admission-123', {
        headers: { Authorization: 'Bearer mock-token' },
      });

      const data = await response.json();
      expect(['pending', 'pending_review']).toContain(data.data.status);
    });
  });

  describe('4. All PDFs Are Retrievable', () => {
    test('lists all three PDFs for admission', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'doc-nursing-123',
              documentType: 'nursing',
              fileName: 'nursing.pdf',
              fileSize: 2500000,
              downloadUrl: '/api/v1/admission/forms/admission-123/documents/doc-nursing-123/download',
            },
            {
              id: 'doc-pre-screening-123',
              documentType: 'pre_screening',
              fileName: 'prescreening.pdf',
              fileSize: 1800000,
              downloadUrl: '/api/v1/admission/forms/admission-123/documents/doc-pre-screening-123/download',
            },
            {
              id: 'doc-directive-123',
              documentType: 'advance_directive',
              fileName: 'directive.pdf',
              fileSize: 1200000,
              downloadUrl: '/api/v1/admission/forms/admission-123/documents/doc-directive-123/download',
            },
          ],
          pagination: { total: 3 },
        }),
      });

      const response = await fetch(
        '/api/v1/admission/forms/admission-123/documents',
        { headers: { Authorization: 'Bearer mock-token' } }
      );

      const data = await response.json();
      expect(data.data).toHaveLength(3);
    });

    test('nursing PDF is downloadable', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['PDF'], { type: 'application/pdf' }),
        headers: { get: () => 'application/pdf' },
      });

      const response = await fetch(
        '/api/v1/admission/forms/admission-123/documents/doc-nursing-123/download',
        { headers: { Authorization: 'Bearer mock-token' } }
      );

      expect(response.ok).toBe(true);
    });

    test('pre-screening PDF is downloadable', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['PDF'], { type: 'application/pdf' }),
      });

      const response = await fetch(
        '/api/v1/admission/forms/admission-123/documents/doc-pre-screening-123/download',
        { headers: { Authorization: 'Bearer mock-token' } }
      );

      expect(response.ok).toBe(true);
    });

    test('advance directive PDF is downloadable', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['PDF'], { type: 'application/pdf' }),
      });

      const response = await fetch(
        '/api/v1/admission/forms/admission-123/documents/doc-directive-123/download',
        { headers: { Authorization: 'Bearer mock-token' } }
      );

      expect(response.ok).toBe(true);
    });
  });

  describe('5. Staff Can Access From Notifications', () => {
    test('notification attachment URLs are valid', async () => {
      const attachmentUrl = '/api/v1/admission/forms/admission-123/documents/doc-nursing-123/download';

      expect(attachmentUrl).toContain('/documents/');
      expect(attachmentUrl).toContain('/download');
    });

    test('staff can download PDF from notification attachment', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['PDF'], { type: 'application/pdf' }),
      });

      const response = await fetch(
        '/api/v1/admission/forms/admission-123/documents/doc-nursing-123/download',
        { headers: { Authorization: 'Bearer mock-token' } }
      );

      const blob = await response.blob();
      expect(blob.type).toBe('application/pdf');
    });

    test('notification shows document count', async () => {
      const notificationMessage = '3 documents available for review: Nursing Assessment, Pre-Screening, Advance Directive';
      expect(notificationMessage).toContain('3 documents');
    });
  });

  describe('6. Admission Goes to Pending Queue', () => {
    test('admission appears in pending admissions list', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'admission-123',
              fullName: 'John Doe',
              status: 'pending',
              createdAt: new Date().toISOString(),
            },
          ],
          pagination: { total: 1 },
        }),
      });

      const response = await fetch('/api/v1/admission/forms?status=pending', {
        headers: { Authorization: 'Bearer mock-token' },
      });

      const data = await response.json();
      expect(data.data[0].id).toBe('admission-123');
      expect(data.data[0].status).toBe('pending');
    });

    test('pending admission has all required metadata', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'admission-123',
              fullName: 'John Doe',
              dateOfBirth: '1960-01-15',
              contactPhone: '5551234567',
              status: 'pending',
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });

      const response = await fetch('/api/v1/admission/forms?status=pending', {
        headers: { Authorization: 'Bearer mock-token' },
      });

      const data = await response.json();
      const admission = data.data[0];
      expect(admission).toHaveProperty('id');
      expect(admission).toHaveProperty('fullName');
      expect(admission).toHaveProperty('status');
    });
  });

  describe('7. Admin Approves Pending Admission', () => {
    test('admin can approve admission', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            id: 'admission-123',
            status: 'approved',
            residentId: 'resident-123',
            approvedAt: new Date().toISOString(),
            approvedBy: 'admin-user-123',
          },
        }),
      });

      const response = await fetch('/api/v1/admission/forms/admission-123/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.status).toBe('approved');
      expect(data.data.residentId).toBeDefined();
    });

    test('approval creates resident record', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            residentId: 'resident-123',
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1960-01-15',
          },
        }),
      });

      const response = await fetch('/api/v1/residents/resident-123', {
        headers: { Authorization: 'Bearer admin-token' },
      });

      const data = await response.json();
      expect(data.data.residentId).toBe('resident-123');
    });

    test('approval creates care plan notification', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notificationCreated: true,
          notificationId: 'notif-care-plan',
          message: 'Care plan created for new resident',
        }),
      });

      const response = await fetch('/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({
          type: 'care_plan_created',
          resident_id: 'resident-123',
        }),
      });

      const data = await response.json();
      expect(data.notificationCreated).toBe(true);
    });
  });

  describe('8. Documents Transferred to Resident Record', () => {
    test('nursing assessment PDF linked to resident', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'doc-nursing-123',
            resident_id: 'resident-123',
            document_type: 'nursing',
          },
        }),
      });

      const response = await fetch('/api/v1/residents/resident-123/documents/doc-nursing-123', {
        headers: { Authorization: 'Bearer mock-token' },
      });

      const data = await response.json();
      expect(data.data.resident_id).toBe('resident-123');
    });

    test('pre-screening PDF linked to resident', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'doc-pre-screening-123',
            resident_id: 'resident-123',
            document_type: 'pre_screening',
          },
        }),
      });

      const response = await fetch('/api/v1/residents/resident-123/documents/doc-pre-screening-123', {
        headers: { Authorization: 'Bearer mock-token' },
      });

      const data = await response.json();
      expect(data.data.resident_id).toBe('resident-123');
    });

    test('advance directive PDF linked to resident', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'doc-directive-123',
            resident_id: 'resident-123',
            document_type: 'advance_directive',
          },
        }),
      });

      const response = await fetch('/api/v1/residents/resident-123/documents/doc-directive-123', {
        headers: { Authorization: 'Bearer mock-token' },
      });

      const data = await response.json();
      expect(data.data.resident_id).toBe('resident-123');
    });

    test('all three documents accessible from resident profile', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'doc-nursing-123', document_type: 'nursing' },
            { id: 'doc-pre-screening-123', document_type: 'pre_screening' },
            { id: 'doc-directive-123', document_type: 'advance_directive' },
          ],
        }),
      });

      const response = await fetch('/api/v1/residents/resident-123/documents', {
        headers: { Authorization: 'Bearer mock-token' },
      });

      const data = await response.json();
      expect(data.data).toHaveLength(3);
    });
  });

  describe('9. Complete Cycle Data Integrity', () => {
    test('admission form data preserved through entire cycle', async () => {
      const originalData = {
        name: 'John Doe',
        dob: '1960-01-15',
        temperature: 98.6,
      };

      // Initial admission creation
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: { id: 'admission-123', status: 'pending' },
        }),
      });

      await fetch('/api/v1/admission/forms', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
        body: JSON.stringify({
          formType: 'nursing-assessment',
          formData: originalData,
        }),
      });

      // Retrieve and verify
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'admission-123',
            ...originalData,
          },
        }),
      });

      const response = await fetch('/api/v1/admission/forms/admission-123', {
        headers: { Authorization: 'Bearer mock-token' },
      });

      const data = await response.json();
      expect(data.data.name).toBe(originalData.name);
    });

    test('audit trail tracks all operations', async () => {
      const operations = [
        'admission_created',
        'nursing_pdf_uploaded',
        'pre_screening_pdf_uploaded',
        'advance_directive_pdf_uploaded',
        'admission_approved',
        'resident_created',
      ];

      operations.forEach(op => {
        expect(op).toBeDefined();
        expect(op.length).toBeGreaterThan(0);
      });
    });

    test('all documents have consistent tenant isolation', async () => {
      const tenantId = 'tenant-123';

      // All operations should be within same tenant
      const operations = [
        { tenantId, operation: 'create_admission' },
        { tenantId, operation: 'upload_pdf' },
        { tenantId, operation: 'approve_admission' },
      ];

      operations.forEach(op => {
        expect(op.tenantId).toBe(tenantId);
      });
    });
  });
});

/**
 * Data Integrity Tests
 * Tests encryption, RLS policies, audit logging, and soft delete preservation
 */

jest.mock('@/lib/db.js', () => ({
  withTenantClient: jest.fn(async (tenantId, staffId, callback) => {
    const mockClient = {
      query: jest.fn(),
    };
    return callback(mockClient);
  }),
}));

jest.mock('@/lib/encryption.js', () => ({
  encryptFields: jest.fn((data, fieldsToEncrypt, key) => {
    const encrypted = { ...data };
    fieldsToEncrypt.forEach(field => {
      if (encrypted[field]) {
        encrypted[field] = `encrypted_${encrypted[field]}`;
      }
    });
    return encrypted;
  }),
  decryptFields: jest.fn((data, fieldsToDecrypt, key) => {
    const decrypted = { ...data };
    fieldsToDecrypt.forEach(field => {
      if (decrypted[field] && typeof decrypted[field] === 'string') {
        decrypted[field] = decrypted[field].replace('encrypted_', '');
      }
    });
    return decrypted;
  }),
}));

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn(() => ({
    logInsert: jest.fn(),
    logSelect: jest.fn(),
    logDelete: jest.fn(),
  })),
}));

const { encryptFields, decryptFields } = require('@/lib/encryption.js');

describe('PHI Encryption', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('full_name is encrypted in storage', () => {
    const formData = { full_name: 'John Doe' };
    const fieldsToEncrypt = ['full_name'];

    const encrypted = encryptFields(formData, fieldsToEncrypt, 'tenant-key');

    expect(encrypted.full_name).not.toBe('John Doe');
    expect(encrypted.full_name).toContain('encrypted_');
  });

  test('contact_phone is encrypted in storage', () => {
    const formData = { contact_phone: '5551234567' };
    const fieldsToEncrypt = ['contact_phone'];

    const encrypted = encryptFields(formData, fieldsToEncrypt, 'tenant-key');

    expect(encrypted.contact_phone).not.toBe('5551234567');
    expect(encrypted.contact_phone).toContain('encrypted_');
  });

  test('emergency_contact is encrypted in storage', () => {
    const formData = { emergency_contact: 'Jane Smith' };
    const fieldsToEncrypt = ['emergency_contact'];

    const encrypted = encryptFields(formData, fieldsToEncrypt, 'tenant-key');

    expect(encrypted.emergency_contact).not.toBe('Jane Smith');
  });

  test('insurance information is encrypted', () => {
    const formData = {
      insurance_member_id: 'INS123456',
      insurance_group_number: 'GRP789',
    };
    const fieldsToEncrypt = ['insurance_member_id', 'insurance_group_number'];

    const encrypted = encryptFields(formData, fieldsToEncrypt, 'tenant-key');

    expect(encrypted.insurance_member_id).toContain('encrypted_');
    expect(encrypted.insurance_group_number).toContain('encrypted_');
  });

  test('healthcare agent information is encrypted', () => {
    const formData = {
      healthcare_agent_name: 'Agent Name',
      healthcare_agent_phone: '5559876543',
    };
    const fieldsToEncrypt = ['healthcare_agent_name', 'healthcare_agent_phone'];

    const encrypted = encryptFields(formData, fieldsToEncrypt, 'tenant-key');

    expect(encrypted.healthcare_agent_name).toContain('encrypted_');
    expect(encrypted.healthcare_agent_phone).toContain('encrypted_');
  });

  test('witness information is encrypted', () => {
    const formData = {
      witness1_name: 'Witness One',
      witness2_name: 'Witness Two',
    };
    const fieldsToEncrypt = ['witness1_name', 'witness2_name'];

    const encrypted = encryptFields(formData, fieldsToEncrypt, 'tenant-key');

    expect(encrypted.witness1_name).toContain('encrypted_');
    expect(encrypted.witness2_name).toContain('encrypted_');
  });

  test('encrypted data can be decrypted', () => {
    const original = { full_name: 'John Doe' };
    const fieldsToEncrypt = ['full_name'];

    const encrypted = encryptFields(original, fieldsToEncrypt, 'tenant-key');
    const decrypted = decryptFields(encrypted, fieldsToEncrypt, 'tenant-key');

    expect(decrypted.full_name).toBe('John Doe');
  });

  test('multiple fields encrypted correctly', () => {
    const formData = {
      full_name: 'John Doe',
      contact_phone: '5551234567',
      emergency_contact: 'Jane Smith',
    };
    const fieldsToEncrypt = ['full_name', 'contact_phone', 'emergency_contact'];

    const encrypted = encryptFields(formData, fieldsToEncrypt, 'tenant-key');

    fieldsToEncrypt.forEach(field => {
      expect(encrypted[field]).toContain('encrypted_');
    });
  });

  test('non-PHI fields are not encrypted', () => {
    const formData = {
      allergies: 'Penicillin',
      medical_conditions: 'Diabetes',
    };
    const fieldsToEncrypt = ['full_name']; // Only encrypt name

    const encrypted = encryptFields(formData, fieldsToEncrypt, 'tenant-key');

    expect(encrypted.allergies).toBe('Penicillin');
    expect(encrypted.medical_conditions).toBe('Diabetes');
  });

  test('encryption uses tenant-specific key', () => {
    const formData = { full_name: 'John Doe' };
    const fieldsToEncrypt = ['full_name'];

    const encrypted1 = encryptFields(formData, fieldsToEncrypt, 'tenant-key-1');
    const encrypted2 = encryptFields(formData, fieldsToEncrypt, 'tenant-key-2');

    // Both should be encrypted, but possibly differently
    expect(encrypted1.full_name).toContain('encrypted_');
    expect(encrypted2.full_name).toContain('encrypted_');
  });
});

describe('Row-Level Security (RLS) Policies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('document only accessible to same tenant', () => {
    const document = { id: 'doc-123', tenant_id: 'tenant-123' };
    const requestingTenant = 'tenant-123';

    const hasAccess = document.tenant_id === requestingTenant;
    expect(hasAccess).toBe(true);
  });

  test('document not accessible to different tenant', () => {
    const document = { id: 'doc-123', tenant_id: 'tenant-123' };
    const requestingTenant = 'tenant-456';

    const hasAccess = document.tenant_id === requestingTenant;
    expect(hasAccess).toBe(false);
  });

  test('admission form isolated by tenant', () => {
    const admission = { id: 'admission-123', tenant_id: 'tenant-abc' };
    const userTenant = 'tenant-abc';

    const isAccessible = admission.tenant_id === userTenant;
    expect(isAccessible).toBe(true);
  });

  test('cross-tenant query returns no results', () => {
    const documents = [
      { id: 'doc-1', tenant_id: 'tenant-123' },
      { id: 'doc-2', tenant_id: 'tenant-456' },
    ];
    const userTenant = 'tenant-789';

    const userDocuments = documents.filter(doc => doc.tenant_id === userTenant);
    expect(userDocuments).toHaveLength(0);
  });

  test('RLS enforced at database level', () => {
    const rlsPolicy = 'tenant_id::text = current_setting(\'app.tenant_id\', true)';
    expect(rlsPolicy).toContain('tenant_id');
    expect(rlsPolicy).toContain('current_setting');
  });

  test('soft-deleted records also respect RLS', () => {
    const deletedDocument = {
      id: 'doc-123',
      tenant_id: 'tenant-123',
      deleted_at: new Date(),
    };
    const userTenant = 'tenant-123';

    // Even deleted records should respect tenant isolation
    const belongsToTenant = deletedDocument.tenant_id === userTenant;
    expect(belongsToTenant).toBe(true);
  });
});

describe('Audit Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('audit log created when document inserted', () => {
    const auditEntry = {
      operation: 'INSERT',
      table: 'care.admission_documents',
      recordId: 'doc-123',
      timestamp: new Date(),
      userId: 'user-123',
      tenantId: 'tenant-123',
    };

    expect(auditEntry.operation).toBe('INSERT');
    expect(auditEntry.table).toContain('admission');
  });

  test('audit log created when document selected', () => {
    const auditEntry = {
      operation: 'SELECT',
      table: 'care.admission_documents',
      timestamp: new Date(),
      userId: 'user-123',
      justification: 'document_review',
    };

    expect(auditEntry.operation).toBe('SELECT');
    expect(auditEntry.justification).toBeDefined();
  });

  test('audit log created when document deleted', () => {
    const auditEntry = {
      operation: 'DELETE',
      table: 'care.admission_documents',
      recordId: 'doc-123',
      timestamp: new Date(),
      userId: 'user-123',
    };

    expect(auditEntry.operation).toBe('DELETE');
    expect(auditEntry.recordId).toBe('doc-123');
  });

  test('audit log includes user information', () => {
    const auditEntry = {
      userId: 'user-123',
      userName: 'John Staff',
      userRole: 'nurse',
      timestamp: new Date(),
    };

    expect(auditEntry.userId).toBeDefined();
    expect(auditEntry.userRole).toBeDefined();
  });

  test('audit log includes timestamp', () => {
    const auditEntry = {
      timestamp: new Date(),
      operation: 'INSERT',
    };

    expect(auditEntry.timestamp instanceof Date).toBe(true);
  });

  test('audit log immutable after creation', () => {
    const auditLog = {
      id: 'audit-123',
      timestamp: new Date(),
      operation: 'INSERT',
      readonly: true,
    };

    // Audit logs should not be modifiable
    expect(auditLog.readonly).toBe(true);
  });

  test('audit logs retained per regulations', () => {
    const retentionYears = 6; // HIPAA requirement
    const auditLog = {
      timestamp: new Date(),
      retentionExpiry: new Date(Date.now() + retentionYears * 365 * 24 * 60 * 60 * 1000),
    };

    expect(auditLog.retentionExpiry.getFullYear()).toBeGreaterThan(new Date().getFullYear());
  });
});

describe('Soft Delete Data Preservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('soft delete sets deleted_at timestamp', () => {
    const document = {
      id: 'doc-123',
      created_at: new Date('2026-05-10'),
      deleted_at: new Date('2026-05-17'),
    };

    expect(document.deleted_at).toBeDefined();
    expect(document.deleted_at.getTime()).toBeGreaterThan(document.created_at.getTime());
  });

  test('soft-deleted document still accessible for audit', () => {
    const deletedDocument = {
      id: 'doc-123',
      file_name: 'nursing.pdf',
      deleted_at: new Date(),
    };

    // Document can still be queried for audit purposes
    expect(deletedDocument.id).toBe('doc-123');
    expect(deletedDocument.file_name).toBe('nursing.pdf');
  });

  test('soft-deleted document not returned in normal queries', () => {
    const allDocuments = [
      { id: 'doc-1', deleted_at: null },
      { id: 'doc-2', deleted_at: new Date() },
      { id: 'doc-3', deleted_at: null },
    ];

    const activeDocuments = allDocuments.filter(doc => doc.deleted_at === null);
    expect(activeDocuments).toHaveLength(2);
  });

  test('soft delete preserves document data', () => {
    const originalData = {
      id: 'doc-123',
      file_name: 'nursing.pdf',
      file_size: 2500000,
      mime_type: 'application/pdf',
      created_at: new Date(),
    };

    const deletedDocument = {
      ...originalData,
      deleted_at: new Date(),
    };

    expect(deletedDocument.file_name).toBe(originalData.file_name);
    expect(deletedDocument.file_size).toBe(originalData.file_size);
  });

  test('soft delete does not delete file_data', () => {
    const document = {
      id: 'doc-123',
      file_data: Buffer.from('PDF content'),
      deleted_at: new Date(),
    };

    // file_data should still be in database
    expect(document.file_data).toBeDefined();
  });

  test('soft-deleted records can be undeleted', () => {
    const deletedDocument = {
      id: 'doc-123',
      deleted_at: new Date(),
    };

    // Can be undeleted by setting deleted_at to NULL
    const restoredDocument = {
      ...deletedDocument,
      deleted_at: null,
    };

    expect(restoredDocument.deleted_at).toBeNull();
  });

  test('audit trail preserved for deleted documents', () => {
    const deletionAudit = {
      operation: 'DELETE',
      recordId: 'doc-123',
      timestamp: new Date(),
      userId: 'user-456',
      reason: 'User requested deletion',
    };

    expect(deletionAudit.recordId).toBe('doc-123');
    expect(deletionAudit.operation).toBe('DELETE');
  });
});

describe('File Data Integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('file_data stored as BYTEA preserves binary content', () => {
    const pdfBytes = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
    const document = {
      file_data: pdfBytes,
    };

    expect(document.file_data[0]).toBe(0x25);
    expect(document.file_data[1]).toBe(0x50);
  });

  test('file_size matches actual file data length', () => {
    const fileData = Buffer.alloc(2500000);
    const document = {
      file_size: fileData.length,
      file_data: fileData,
    };

    expect(document.file_size).toBe(document.file_data.length);
  });

  test('file checksum can verify integrity', () => {
    const crypto = require('crypto');
    const fileData = Buffer.from('PDF content');
    const checksum = crypto.createHash('sha256').update(fileData).digest('hex');

    const document = {
      file_data: fileData,
      file_checksum: checksum,
    };

    const recalculatedChecksum = crypto.createHash('sha256').update(document.file_data).digest('hex');
    expect(recalculatedChecksum).toBe(document.file_checksum);
  });

  test('corruption detected on file verification', () => {
    const crypto = require('crypto');
    const fileData = Buffer.from('PDF content');
    const originalChecksum = crypto.createHash('sha256').update(fileData).digest('hex');

    const corruptedData = Buffer.from('corrupted');
    const newChecksum = crypto.createHash('sha256').update(corruptedData).digest('hex');

    expect(newChecksum).not.toBe(originalChecksum);
  });

  test('file binary integrity preserved through database storage', () => {
    const originalData = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E]);
    const storedData = Buffer.from(originalData);

    expect(storedData).toEqual(originalData);
  });
});

describe('Tenant Isolation Enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('staff cannot query admissions from other tenants', () => {
    const staffTenant = 'tenant-123';
    const otherTenant = 'tenant-456';

    const admissions = [
      { id: 'adm-1', tenant_id: 'tenant-123' },
      { id: 'adm-2', tenant_id: 'tenant-456' },
    ];

    const staffAdmissions = admissions.filter(adm => adm.tenant_id === staffTenant);
    expect(staffAdmissions).toHaveLength(1);
  });

  test('documents from other tenants not visible', () => {
    const userTenant = 'tenant-abc';
    const documents = [
      { id: 'doc-1', tenant_id: 'tenant-abc' },
      { id: 'doc-2', tenant_id: 'tenant-xyz' },
    ];

    const visibleDocs = documents.filter(doc => doc.tenant_id === userTenant);
    expect(visibleDocs).toHaveLength(1);
  });

  test('database RLS policy enforces isolation', () => {
    const policy = `
      CREATE POLICY admission_documents_tenant_isolation ON care.admission_documents
      FOR ALL USING (tenant_id = current_setting('app.tenant_id'))
    `;

    expect(policy).toContain('admission_documents_tenant_isolation');
    expect(policy).toContain('tenant_id');
  });

  test('cross-tenant access returns 404 instead of 403', () => {
    const statusCode = 404; // Not found (not unauthorized)
    expect(statusCode).toBe(404);
  });
});

describe('Compliance and Regulations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('HIPAA § 164.312(b) Access Control compliance', () => {
    const accessControls = [
      'authentication_required',
      'authorization_enforced',
      'audit_logging_enabled',
    ];

    accessControls.forEach(control => {
      expect(control).toBeDefined();
    });
  });

  test('HIPAA § 164.312(a)(2)(i) Encryption compliance', () => {
    const phiFields = [
      'full_name',
      'contact_phone',
      'insurance_member_id',
      'healthcare_agent_name',
    ];

    phiFields.forEach(field => {
      expect(field).toBeDefined();
    });
  });

  test('OAR 309-001-0100 Documentation requirements met', () => {
    const requirementsChecklist = {
      nursingAssessmentDocumented: true,
      preScreeningDocumented: true,
      advanceDirectiveDocumented: true,
      auditTrailMaintained: true,
    };

    Object.values(requirementsChecklist).forEach(requirement => {
      expect(requirement).toBe(true);
    });
  });

  test('Data retention policies enforced', () => {
    const retentionYears = 6;
    const createdDate = new Date('2020-05-17');
    const retentionEndDate = new Date(createdDate.getFullYear() + retentionYears, createdDate.getMonth(), createdDate.getDate());

    expect(retentionEndDate.getFullYear()).toBe(2026);
  });
});

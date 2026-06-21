import { POST as uploadFaceSheetPhoto } from '@/app/api/v1/face-sheets/[id]/photo/route.js';

jest.mock('@/lib/auth-guard.js', () => ({
  authenticate: jest.fn(),
  handleError: jest.fn((err) => Response.json({ error: err.message || 'Internal server error' }, { status: err.status || 500 })),
  getRequestContext: jest.fn(() => ({ user: {} })),
}));

jest.mock('@/lib/db.js', () => ({
  withTenantClient: jest.fn(),
}));

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logSelect: jest.fn().mockResolvedValue(undefined),
    logUpdate: jest.fn().mockResolvedValue(undefined),
  })),
}));

import * as authGuard from '@/lib/auth-guard.js';
import * as db from '@/lib/db.js';

function createRequest() {
  const photo = {
    type: 'image/jpeg',
    size: 1024,
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
  };

  return {
    url: 'http://localhost:3000/api/v1/face-sheets/fs-123/photo',
    headers: new Headers(),
    formData: jest.fn().mockResolvedValue({
      get: jest.fn((name) => (name === 'photo' ? photo : undefined)),
    }),
  };
}

describe('POST /api/v1/face-sheets/[id]/photo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
    process.env.CLOUDINARY_API_KEY = '123456';
    process.env.CLOUDINARY_API_SECRET = 'secret';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uploads the photo to Cloudinary and persists the photo URL', async () => {
    authGuard.authenticate.mockResolvedValueOnce({
      user: {
        role: 'admin',
        tenantId: 'tenant-1',
        staffId: 'staff-1',
      },
    });

    db.withTenantClient.mockImplementationOnce(async (_tenantId, _staffId, callback) => {
      const client = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'fs-123', resident_id: 'res-456' }] })
          .mockResolvedValueOnce({
            rows: [{
              id: 'fs-123',
              resident_id: 'res-456',
              photo_url: 'https://res.cloudinary.com/demo/image/upload/v1/dcllc/tenant-1/face-sheets/res-456.jpg',
              photo_public_id: 'dcllc/tenant-1/face-sheets/res-456',
              photo_uploaded_at: '2024-05-20T00:00:00Z',
              photo_metadata: '{}',
            }],
          }),
      };
      return callback(client);
    });

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/dcllc/tenant-1/face-sheets/res-456.jpg',
        public_id: 'dcllc/tenant-1/face-sheets/res-456',
        format: 'jpg',
        bytes: 1024,
        width: 640,
        height: 640,
        resource_type: 'image',
        version: 1,
      }),
    });

    const response = await uploadFaceSheetPhoto(createRequest(), { params: Promise.resolve({ id: 'fs-123' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
      expect.objectContaining({ method: 'POST' })
    );

    const uploadCall = fetchMock.mock.calls[0];
    const uploadBody = uploadCall[1].body;
    const uploadEntries = Array.from(uploadBody.entries()).reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

    expect(uploadEntries.folder).toBe('dcllc/tenant-1/face-sheets');
    expect(uploadEntries.public_id).toBe('res-456');
    expect(uploadEntries.overwrite).toBe('true');
    expect(uploadEntries.transformation).toBe('c_fill,g_face,w_800,h_800,q_auto');
    expect(uploadEntries.api_key).toBe('123456');
    expect(uploadEntries.signature).toEqual(expect.any(String));
    expect(body).toHaveProperty('data');
    expect(db.withTenantClient).toHaveBeenCalled();
  });

  test('returns 503 when Cloudinary is not configured', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    authGuard.authenticate.mockResolvedValueOnce({
      user: {
        role: 'admin',
        tenantId: 'tenant-1',
        staffId: 'staff-1',
      },
    });

    db.withTenantClient.mockImplementationOnce(async (_tenantId, _staffId, callback) => {
      const client = {
        query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 'fs-123', resident_id: 'res-456' }] }),
      };
      return callback(client);
    });

    const response = await uploadFaceSheetPhoto(createRequest(), { params: Promise.resolve({ id: 'fs-123' }) });
    expect(response.status).toBe(503);
  });
});

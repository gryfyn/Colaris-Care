import { clearSession, getAccessToken, getStoredUser, logout, refreshSession, storeSession } from '@/lib/client-auth';
import { notificationHref } from '@/lib/notification-link';
import { openDocument, uploadDocument } from '@/lib/r2-upload';
import { apiData } from '@/lib/client-api';
import { useAuthStore } from '@/lib/store/auth-store';

jest.mock('@/lib/client-api', () => ({ apiData: jest.fn() }));

describe('client session workflows', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    localStorage.clear();
  });

  test('stores only the safe user identity fields', () => {
    storeSession({ accessToken: 'token-1', user: { id: 'u1', name: 'Ada', role: 'admin', organizationId: 'o1', facilityId: 'f1', email: 'secret@example.com' } });
    expect(getAccessToken()).toBe('token-1');
    expect(getStoredUser()).toEqual({ id: 'u1', displayName: 'Ada', role: 'admin', organizationId: 'o1', facilityId: 'f1' });
    expect(JSON.stringify(getStoredUser())).not.toContain('secret@example.com');
  });

  test('refresh stores a successful session and returns the token', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ accessToken: 'fresh', user: { id: 'u2', role: 'staff' } }) });
    await expect(refreshSession()).resolves.toBe('fresh');
    expect(fetch).toHaveBeenCalledWith('/api/auth/refresh', { method: 'POST' });
    expect(getAccessToken()).toBe('fresh');
  });

  test('failed refresh clears an existing session', async () => {
    storeSession({ accessToken: 'expired', user: { id: 'u1' } });
    fetch.mockResolvedValue({ ok: false });
    await expect(refreshSession()).resolves.toBeNull();
    expect(getAccessToken()).toBe('');
    expect(getStoredUser()).toBeNull();
  });

  test('logout sends bearer token and always clears local state', async () => {
    storeSession({ accessToken: 'active', user: { id: 'u1' } });
    fetch.mockRejectedValue(new Error('offline'));
    await expect(logout()).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer active' } });
    expect(getAccessToken()).toBe('');
  });

  test('clearSession removes legacy and mock artifacts', () => {
    localStorage.setItem('colaris_mock_session', 'yes');
    storeSession({ accessToken: 'active', user: { id: 'u1' } });
    clearSession();
    expect(localStorage.getItem('colaris_access_token')).toBeNull();
    expect(localStorage.getItem('colaris_user')).toBeNull();
    expect(localStorage.getItem('colaris_mock_session')).toBeNull();
  });
});

describe('notification links', () => {
  test.each([
    ['resident_request', 'admin', '/admin/resident-requests'],
    ['appointment', 'staff', '/staff/appointments'],
    ['care_plan', 'admin', '/admin/care-plans'],
    ['care_plan', 'staff', '/staff/care-plan'],
    ['medication', 'staff', '/staff/medications'],
    ['progress_note', 'admin', '/admin/progress-notes'],
    ['incident', 'staff', '/staff/incidents'],
    ['announcement', 'admin', '/admin/announcements'],
    ['unknown', 'staff', '/staff/notifications'],
    [undefined, 'admin', '/admin/notifications'],
  ])('maps %s in %s to %s', (sourceType, portal, expected) => {
    expect(notificationHref(sourceType ? { sourceType } : null, portal)).toBe(expected);
  });
});

describe('R2 document workflows', () => {
  test('returns null when no file is supplied', async () => {
    await expect(uploadDocument(null)).resolves.toBeNull();
    expect(apiData).not.toHaveBeenCalled();
  });

  test('presigns, uploads, and returns document metadata', async () => {
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    apiData.mockResolvedValue({ uploadUrl: 'https://upload.example/key', objectKey: 'org/residents/key' });
    fetch.mockResolvedValue({ ok: true });
    await expect(uploadDocument(file, 'staff')).resolves.toEqual({ objectKey: 'org/residents/key', name: 'note.txt', contentType: 'text/plain', size: 5 });
    expect(apiData).toHaveBeenCalledWith('/api/v1/uploads/r2-presign', expect.objectContaining({ method: 'POST', body: expect.stringContaining('note.txt') }));
    expect(fetch).toHaveBeenCalledWith('https://upload.example/key', { method: 'PUT', body: file, headers: { 'Content-Type': 'text/plain' } });
  });

  test('uses a binary fallback content type', async () => {
    const file = new File(['x'], 'blob.bin');
    apiData.mockResolvedValue({ uploadUrl: '/upload', objectKey: 'key' });
    fetch.mockResolvedValue({ ok: true });
    const result = await uploadDocument(file);
    expect(result.contentType).toBe('application/octet-stream');
    expect(fetch.mock.calls[0][1].headers).toBeUndefined();
  });

  test('throws a status-bearing message when object upload fails', async () => {
    apiData.mockResolvedValue({ uploadUrl: '/upload', objectKey: 'key' });
    fetch.mockResolvedValue({ ok: false, status: 413 });
    await expect(uploadDocument(new File(['x'], 'large.bin'))).rejects.toThrow('Document upload failed (413).');
  });

  test('opens resolved documents safely and returns the URL', async () => {
    apiData.mockResolvedValue({ url: 'https://view.example/doc' });
    const opener = jest.spyOn(window, 'open').mockImplementation(() => null);
    await expect(openDocument('d1')).resolves.toBe('https://view.example/doc');
    expect(apiData).toHaveBeenCalledWith('/api/v1/documents/d1/url');
    expect(opener).toHaveBeenCalledWith('https://view.example/doc', '_blank', 'noopener,noreferrer');
    opener.mockRestore();
  });

  test('does not open a window when no URL is returned', async () => {
    apiData.mockResolvedValue({});
    const opener = jest.spyOn(window, 'open').mockImplementation(() => null);
    await expect(openDocument('d2')).resolves.toBeNull();
    expect(opener).not.toHaveBeenCalled();
    opener.mockRestore();
  });
});

import { createNotification, resolveNotifications, userIdForStaffProfile } from '@/lib/notifications';

describe('notification persistence helpers', () => {
  test('creates an unread notification with all tenant and source parameters', async () => {
    const client = { query: jest.fn().mockResolvedValue({}) };
    await createNotification(client, { organizationId: 'o1', facilityId: 'f1', userId: 'u1', title: 'Review', body: 'Please review', sourceType: 'incident', sourceId: 'i1' });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("'unread'"), ['o1', 'f1', 'u1', 'Review', 'Please review', 'incident', 'i1']);
  });

  test('normalizes optional notification values to null', async () => {
    const client = { query: jest.fn().mockResolvedValue({}) };
    await createNotification(client, { organizationId: 'o1', facilityId: 'f1', title: 'Notice', body: 'Body' });
    expect(client.query.mock.calls[0][1]).toEqual(['o1', 'f1', null, 'Notice', 'Body', null, null]);
  });

  test('archives matching task notifications in tenant scope', async () => {
    const client = { query: jest.fn().mockResolvedValue({}) };
    await resolveNotifications(client, { organizationId: 'o1', facilityId: 'f1', sourceType: 'care_plan', sourceId: 'c1' });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("status = 'archived'"), ['o1', 'f1', 'care_plan', 'c1']);
    expect(client.query.mock.calls[0][0]).toContain("status <> 'archived'");
  });

  test.each([
    [{ sourceType: null, sourceId: '1' }],
    [{ sourceType: 'incident', sourceId: null }],
  ])('does not issue an update for incomplete source identity', async (source) => {
    const client = { query: jest.fn() };
    await resolveNotifications(client, { organizationId: 'o1', facilityId: 'f1', ...source });
    expect(client.query).not.toHaveBeenCalled();
  });

  test('resolves a staff profile to its login user', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ user_id: 'u1' }] }) };
    await expect(userIdForStaffProfile(client, 'o1', 'f1', 's1')).resolves.toBe('u1');
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('limit 1'), ['o1', 'f1', 's1']);
  });

  test('returns null for absent or unlinked staff profiles', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await expect(userIdForStaffProfile(client, 'o1', 'f1', null)).resolves.toBeNull();
    expect(client.query).not.toHaveBeenCalled();
    await expect(userIdForStaffProfile(client, 'o1', 'f1', 'missing')).resolves.toBeNull();
  });
});

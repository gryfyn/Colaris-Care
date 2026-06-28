jest.mock('@/lib/auth-guard.js', () => {
  class AuthError extends Error {
    constructor(message, status = 401, code = 'AUTH_ERROR') {
      super(message); this.status = status; this.code = code;
    }
  }
  return {
    AuthError,
    requireUser: jest.fn(),
    authErrorResponse: jest.fn((err) => Response.json({ error: err.message, code: err.code }, { status: err.status })),
  };
});
jest.mock('@/lib/db.js', () => ({ withRequestContext: jest.fn() }));
jest.mock('@/lib/prisma-context.js', () => ({ withPrismaContext: jest.fn() }));
jest.mock('@/lib/logger.js', () => ({ __esModule: true, default: { error: jest.fn() } }));

import { AuthError, authErrorResponse, requireUser } from '@/lib/auth-guard.js';
import { withRequestContext } from '@/lib/db.js';
import logger from '@/lib/logger.js';
import { withPrismaContext } from '@/lib/prisma-context.js';
import { jsonError, readJson, withApiContext, withPrismaApiContext } from '@/lib/api-helpers.js';

const user = { id: 'u1', role: 'admin' };

describe('API helpers', () => {
  test('jsonError applies defaults and supports custom status/code', async () => {
    const standard = jsonError('Bad input');
    expect(standard.status).toBe(400);
    expect(await standard.json()).toEqual({ error: 'Bad input', code: 'BAD_REQUEST' });
    const custom = jsonError('Conflict', 409, 'DUPLICATE');
    expect(custom.status).toBe(409);
    expect(await custom.json()).toEqual({ error: 'Conflict', code: 'DUPLICATE' });
  });

  test('readJson returns parsed bodies', async () => {
    await expect(readJson({ json: jest.fn().mockResolvedValue({ name: 'Ada' }) })).resolves.toEqual({ name: 'Ada' });
  });

  test('readJson normalizes parse failures into AuthError', async () => {
    await expect(readJson({ json: jest.fn().mockRejectedValue(new SyntaxError()) })).rejects.toMatchObject({
      message: 'Invalid JSON request body', status: 400, code: 'INVALID_JSON',
    });
  });

  test('withApiContext authenticates, scopes, and wraps results', async () => {
    requireUser.mockResolvedValue(user);
    const client = { query: jest.fn() };
    withRequestContext.mockImplementation(async (_user, _action, callback) => callback(client));
    const handler = jest.fn().mockResolvedValue({ id: 'r1' });
    const response = await withApiContext({ url: '/residents' }, 'residents:read', 'resident.list', handler);
    expect(requireUser).toHaveBeenCalledWith({ url: '/residents' }, 'residents:read');
    expect(withRequestContext).toHaveBeenCalledWith(user, 'resident.list', expect.any(Function));
    expect(handler).toHaveBeenCalledWith({ client, user });
    expect(await response.json()).toEqual({ data: { id: 'r1' } });
  });

  test('withApiContext uses permission as the default audit action', async () => {
    requireUser.mockResolvedValue(user);
    withRequestContext.mockImplementation(async (_user, _action, callback) => callback({}));
    await withApiContext({}, 'residents:read', '', () => []);
    expect(withRequestContext.mock.calls[0][1]).toBe('residents:read');
  });

  test.each([
    [new AuthError('Sign in', 401, 'AUTH_REQUIRED'), 401],
    [Object.assign(new Error('Forbidden'), { status: 403, code: 'NOPE' }), 403],
  ])('delegates authentication errors to authErrorResponse', async (error, status) => {
    requireUser.mockRejectedValue(error);
    const response = await withApiContext({}, 'x', 'x', jest.fn());
    expect(authErrorResponse).toHaveBeenCalledWith(error);
    expect(response.status).toBe(status);
  });

  test('returns safe messages and logs unexpected server failures', async () => {
    requireUser.mockResolvedValue(user);
    const error = Object.assign(new Error('database password leaked'), { code: 'DB_DOWN', detail: 'detail' });
    withRequestContext.mockRejectedValue(error);
    const response = await withApiContext({}, 'x', 'record.list', jest.fn());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error', code: 'DB_DOWN' });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ err: error, action: 'record.list' }), '[withApiContext] handler failure');
  });

  test('preserves client-safe messages for non-500 application errors', async () => {
    requireUser.mockResolvedValue(user);
    withRequestContext.mockRejectedValue(Object.assign(new Error('Already exists'), { statusCode: 409, code: 'DUPLICATE' }));
    const response = await withApiContext({}, 'x', 'x', jest.fn());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Already exists', code: 'DUPLICATE' });
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('withPrismaApiContext supplies a scoped transaction', async () => {
    requireUser.mockResolvedValue(user);
    const tx = { resident: {} };
    withPrismaContext.mockImplementation(async (_user, _action, callback) => callback(tx));
    const handler = jest.fn().mockResolvedValue(['r1']);
    const response = await withPrismaApiContext({}, 'residents:read', 'resident.list', handler);
    expect(withPrismaContext).toHaveBeenCalledWith(user, 'resident.list', expect.any(Function));
    expect(handler).toHaveBeenCalledWith({ tx, user });
    expect(await response.json()).toEqual({ data: ['r1'] });
  });

  test('withPrismaApiContext protects internal error messages', async () => {
    requireUser.mockResolvedValue(user);
    withPrismaContext.mockRejectedValue(new Error('connection string'));
    const response = await withPrismaApiContext({}, 'x', 'x', jest.fn());
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe('Internal server error');
  });
});

/**
 * Regression: a cold-start DB warmup failure on serverless (Vercel) must NOT
 * call process.exit() — doing so killed the function mid-request and turned a
 * recoverable Postgres cold-start blip into a hard 500 on /api/v1/auth/login.
 * Each request handler reconnects via the pool, so warmup is best-effort.
 */
const mockHealthCheck = jest.fn();
const mockPoolEnd = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/db.js', () => ({
  pool: { end: mockPoolEnd },
  healthCheck: mockHealthCheck,
}));

describe('instrumentation register() DB warmup', () => {
  const ORIGINAL_ENV = process.env;
  let exitSpy;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, NEXT_RUNTIME: 'nodejs' };
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('does not exit the process when warmup fails on Vercel serverless', async () => {
    process.env.VERCEL = '1';
    process.env.NODE_ENV = 'production';
    mockHealthCheck.mockRejectedValue(new Error('Connection terminated due to connection timeout'));

    const { register } = require('@/instrumentation.js');
    await register();

    expect(mockHealthCheck).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('retries and succeeds without exiting when a later attempt connects', async () => {
    process.env.VERCEL = '1';
    process.env.NODE_ENV = 'production';
    mockHealthCheck
      .mockRejectedValueOnce(new Error('cold start timeout'))
      .mockResolvedValueOnce('2026-06-06T00:00:00Z');

    const { register } = require('@/instrumentation.js');
    await register();

    expect(mockHealthCheck).toHaveBeenCalledTimes(2);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('still fail-fasts in non-serverless production when the DB is unreachable', async () => {
    delete process.env.VERCEL;
    process.env.NODE_ENV = 'production';
    mockHealthCheck.mockRejectedValue(new Error('db down'));

    const { register } = require('@/instrumentation.js');
    await register();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

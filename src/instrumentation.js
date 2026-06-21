export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { pool, healthCheck } = await import('@/lib/db.js');

    // Warm the DB connection on boot. This is best-effort: a cold or restarting
    // Postgres instance may still be coming up and the first connect can time
    // out. That is NOT fatal — every request handler
    // reconnects via the pool (see src/lib/db.js), so killing the process here
    // just turns a recoverable cold-start blip into a hard 500 on the in-flight
    // request. Retry a few times to warm the pool, and only fail-fast in a
    // long-running (non-serverless) production process where a crash-restart is
    // the intended recovery.
    const isServerless = !!process.env.VERCEL;
    const WARMUP_ATTEMPTS = 3;
    let warmed = false;
    for (let attempt = 1; attempt <= WARMUP_ATTEMPTS && !warmed; attempt++) {
      try {
        const dbTime = await healthCheck();
        console.log(`[Instrumentation] PostgreSQL connected (${dbTime})`);
        warmed = true;
      } catch (err) {
        console.error(
          `[Instrumentation] Database warmup attempt ${attempt}/${WARMUP_ATTEMPTS} failed:`,
          err?.message || err
        );
        if (attempt < WARMUP_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        }
      }
    }
    if (!warmed && !isServerless && process.env.NODE_ENV === 'production') {
      console.error('[Instrumentation] Database unreachable after warmup retries — exiting for restart');
      process.exit(1);
    }

    const shutdown = async (signal) => {
      console.log(`[Instrumentation] ${signal} received — draining connections`);
      try {
        await pool.end();
        console.log('[Instrumentation] Clean shutdown complete');
      } catch (e) {
        console.error('[Instrumentation] Shutdown error:', e);
      }
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

    process.on('unhandledRejection', (err) => {
      console.error('[Instrumentation] Unhandled rejection — exiting', err);
      process.exit(1);
    });
  }
}

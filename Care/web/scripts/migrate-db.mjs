import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildClient } from './database-connection.mjs';

const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'db', 'migrations');

const client = buildClient({ preferMigration: true });

await client.connect();

try {
  await client.query(`
    create schema if not exists app;
    create table if not exists app.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
    alter table app.schema_migrations add column if not exists content_hash text;
  `);

  const files = (await fs.readdir(migrationsDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    const hash = sha256(sql);
    const seen = await client.query(
      'select content_hash from app.schema_migrations where filename = $1',
      [file]
    );
    if (seen.rowCount) {
      // Guard: an already-applied migration whose file changed will silently
      // never re-run (the runner tracks by filename). Catch that drift here —
      // it is exactly what hid the missing care.admissions table before.
      const stored = seen.rows[0].content_hash;
      if (stored && stored !== hash) {
        throw new Error(
          `Migration "${file}" has changed since it was applied (content hash mismatch). ` +
          `Already-applied migrations are immutable — add a new migration instead of editing this one.`
        );
      }
      if (!stored) {
        // Backfill the hash for migrations applied before this guard existed.
        await client.query('update app.schema_migrations set content_hash = $2 where filename = $1', [file, hash]);
      }
      console.log(`skip ${file}`);
      continue;
    }

    console.log(`apply ${file}`);
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query(
        'insert into app.schema_migrations(filename, content_hash) values ($1, $2)',
        [file, hash]
      );
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    }
  }
} finally {
  await client.end();
}

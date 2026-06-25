import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildClient } from './database-connection.mjs';

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
  `);

  const files = (await fs.readdir(migrationsDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const seen = await client.query(
      'select 1 from app.schema_migrations where filename = $1',
      [file]
    );
    if (seen.rowCount) {
      console.log(`skip ${file}`);
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    console.log(`apply ${file}`);
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query(
        'insert into app.schema_migrations(filename) values ($1)',
        [file]
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

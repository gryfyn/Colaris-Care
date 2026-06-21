import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const env = {};
  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
  }
}

const localEnv = parseEnvFile(resolve(process.cwd(), '.vercel/.env.production.local'));

const cloudinary = {
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || localEnv.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || localEnv.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || localEnv.CLOUDINARY_API_SECRET,
};

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error('Missing VERCEL_TOKEN. Export it before running this script.');
  process.exit(1);
}

const targets = (process.env.VERCEL_TARGETS || 'production,preview')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const missing = Object.entries(cloudinary)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  console.error(`Missing Cloudinary values: ${missing.join(', ')}`);
  process.exit(1);
}

const vercelBin = process.platform === 'win32' ? 'vercel.cmd' : 'vercel';
for (const target of targets) {
  for (const [name, value] of Object.entries(cloudinary)) {
    run(vercelBin, [
      'env',
      'add',
      name,
      target,
      '--value',
      value,
      '--yes',
      '--force',
      '--token',
      token,
    ], {});
    console.log(`Synced ${name} to Vercel ${target}.`);
  }
}


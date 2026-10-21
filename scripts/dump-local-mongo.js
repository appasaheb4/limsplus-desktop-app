#!/usr/bin/env node
/**
 * Refresh client/database/dump from the same local Mongo the Nest backend uses.
 * Reads MONGODB_URL_LOCAL from limsplus-service/.env (override root with LIMSPLUS_SERVICE_PATH).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const serviceRoot = path.resolve(
  process.env.LIMSPLUS_SERVICE_PATH ||
    path.join(root, '..', 'limsplus-service'),
);
const envPath = path.join(serviceRoot, '.env');
const outDir = path.join(root, 'client', 'database', 'dump');

function die(msg) {
  console.error(`dump-database: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(envPath)) {
  die(`missing ${envPath}`);
}

const envText = fs.readFileSync(envPath, 'utf8');
const match = envText.match(/^MONGODB_URL_LOCAL\s*=\s*(.+)$/m);
if (!match) {
  die(`MONGODB_URL_LOCAL is not set in ${envPath}`);
}

const uri = match[1].trim().replace(/^['"]|['"]$/g, '');
let dbName = 'limsplus-prod';
try {
  const parsed = new URL(uri);
  dbName = parsed.pathname.replace(/^\//, '').split('/')[0] || dbName;
} catch {
  die('MONGODB_URL_LOCAL is not a valid mongodb URL');
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const result = spawnSync('mongodump', ['--uri', uri, '--out', outDir], {
  stdio: 'inherit',
});
if (result.error) {
  die(
    result.error.code === 'ENOENT'
      ? 'mongodump was not found on PATH. Install MongoDB Database Tools.'
      : result.error.message,
  );
}
if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log(
  `dump-database: wrote ${path.join(outDir, dbName)} from MONGODB_URL_LOCAL`,
);

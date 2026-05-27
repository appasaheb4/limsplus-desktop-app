/**
 * Canonical version: repo root package.json (patch +1).
 * Mirrors the new version into client/package.json for electron-builder.
 *
 * Skip: SKIP_VERSION_BUMP=1 yarn production:mac
 */

const fs = require('fs');
const path = require('path');

if (process.env.SKIP_VERSION_BUMP === '1' || process.env.SKIP_VERSION_BUMP === 'true') {
  console.info('[version] SKIP_VERSION_BUMP set — leaving package.json unchanged.');
  process.exit(0);
}

const rootDir = path.join(__dirname, '..');
const rootPkgPath = path.join(rootDir, 'package.json');
const clientPkgPath = path.join(rootDir, 'client', 'package.json');

function bumpStrictPatch(version) {
  const core = String(version || '0.0.0').split('-')[0].split('+')[0];
  const segs = core.split('.');
  while (segs.length < 3) segs.push('0');
  const major = parseInt(segs[0], 10) || 0;
  const minor = parseInt(segs[1], 10) || 0;
  const patch = parseInt(segs[2], 10) || 0;
  return `${major}.${minor}.${patch + 1}`;
}

function writePkg(pkgPath, obj) {
  fs.writeFileSync(pkgPath, `${JSON.stringify(obj, null, 2)}\n`);
}

function main() {
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  const prev = rootPkg.version;
  const next = bumpStrictPatch(prev);
  rootPkg.version = next;
  writePkg(rootPkgPath, rootPkg);

  const clientPkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));
  clientPkg.version = next;
  writePkg(clientPkgPath, clientPkg);

  console.info(`[version] bumped ${prev} → ${next} (root + client synced)`);
}

main();

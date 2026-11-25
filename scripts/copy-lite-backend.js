#!/usr/bin/env node
/**
 * Copies limsplus-service `dist/` and `node_modules/` into client/app/backend
 * so Nest Lite can resolve @nestjs/core and other deps at runtime.
 *
 * Override source root: LIMSPLUS_SERVICE_PATH=/absolute/or/relative/path
 */
const fs = require('fs');
const path = require('path');
const { rewriteSymlinksInside } = require('./rewrite-bundle-symlinks');

const root = path.join(__dirname, '..');
const serviceRoot = path.resolve(
  process.env.LIMSPLUS_SERVICE_PATH ||
    path.join(root, '..', 'limsplus-service'),
);
const distSrc = path.join(serviceRoot, 'dist');
const nmSrc = path.join(serviceRoot, 'node_modules');
const dest = path.join(root, 'client', 'app', 'backend');

function die(msg) {
  console.error(`copy-backend: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(distSrc)) {
  die(
    `missing ${distSrc} — build the service first (e.g. cd limsplus-service && yarn build).`,
  );
}
if (!fs.existsSync(nmSrc)) {
  die(`missing ${nmSrc} — run yarn install in ${serviceRoot} first.`);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(distSrc, dest, { recursive: true });
fs.cpSync(nmSrc, path.join(dest, 'node_modules'), { recursive: true });

const links = rewriteSymlinksInside(dest);
console.log(
  `copy-backend: symlinks rewritten=${links.rewritten} removed=${links.removed} unmapped=${links.unmapped.length}`,
);
if (links.unmapped.length) {
  die(
    `symlinks still point outside ${dest}:\n${links.unmapped.slice(0, 20).join('\n')}`,
  );
}

console.log(
  `copy-backend: copied ${distSrc} + ${nmSrc}\n → ${dest}`,
);

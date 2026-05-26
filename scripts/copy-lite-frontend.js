#!/usr/bin/env node
/**
 * Copies limsplus-portal production build into client/app/frontend for
 * electron-builder extraResources (portal-build) and Lite static server.
 *
 * Override source: LIMSPLUS_PORTAL_PATH=/absolute/or/relative/path
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const portalRoot = path.resolve(
  process.env.LIMSPLUS_PORTAL_PATH ||
    path.join(root, '..', 'limsplus-portal'),
);
const buildSrc = path.join(portalRoot, 'build');
const dest = path.join(root, 'client', 'app', 'frontend');

function die(msg) {
  console.error(`copy-frontend: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(buildSrc)) {
  die(
    `missing ${buildSrc} — build the portal first (e.g. cd limsplus-portal && yarn build).`,
  );
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(buildSrc, dest, { recursive: true });
console.log(`copy-frontend: copied ${buildSrc}\n → ${dest}`);

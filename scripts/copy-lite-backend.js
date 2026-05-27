#!/usr/bin/env node
/**
 * Copies limsplus-service `dist/` and `node_modules/` into client/app/backend
 * so Nest Lite can resolve @nestjs/core and other deps at runtime.
 *
 * Override source root: LIMSPLUS_SERVICE_PATH=/absolute/or/relative/path
 */
const fs = require('fs');
const path = require('path');

/** Old service builds called `listen(8080)` only; Lite now passes **`PORT`** from Electron (still often **8080** after freeing the port). */
function patchNestMainListenIfLegacy8080(backendRoot) {
  const mainJsPath = path.join(backendRoot, 'main.js');
  if (!fs.existsSync(mainJsPath)) return false;
  let src = fs.readFileSync(mainJsPath, 'utf8');
  if (!src.includes('await app.listen(8080')) return false;

  const re =
    /await app\.listen\(8080\s*,\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\)\s*;?/;
  const replacement = [
    'const __limsLitePort = (() => {',
    "      const raw = Number.parseInt(process.env.PORT ?? '8080', 10);",
    '      return Number.isFinite(raw) && raw > 0 ? raw : 8080;',
    '    })();',
    '    const __limsLiteHost =',
    "      typeof process.env.HOST === 'string' && process.env.HOST.trim() !== ''",
    '        ? process.env.HOST.trim()',
    "        : '0.0.0.0';",
    '    await app.listen(__limsLitePort, __limsLiteHost, () => {',
    '        console.log(`api server listening on http://${__limsLiteHost}:${__limsLitePort}`);',
    '    });',
  ].join('\n');

  const next = src.replace(re, replacement);
  if (next === src) {
    console.warn(
      'copy-backend: found listen(8080) but could not regex-patch — reinstall from a rebuilt limsplus-service or edit client/app/backend/main.js manually.',
    );
    return false;
  }
  fs.writeFileSync(mainJsPath, next, 'utf8');
  return true;
}

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
  die(
    `missing ${nmSrc} — run yarn install in ${serviceRoot} first.`,
  );
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(distSrc, dest, { recursive: true });
fs.cpSync(nmSrc, path.join(dest, 'node_modules'), { recursive: true });

if (patchNestMainListenIfLegacy8080(dest)) {
  console.log(
    'copy-backend: patched Nest main.js to honor PORT/HOST (was listen(8080)).',
  );
}

console.log(
  `copy-backend: copied ${distSrc} + ${nmSrc}\n → ${dest}`,
);

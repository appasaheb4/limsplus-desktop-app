/**
 * Writes install-identity.json into client/assets before electron-builder.
 * Packaged app compares this file with stored state to purge caches on every new install/build.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const clientPkgPath = path.join(__dirname, '..', 'client', 'package.json');
const outPath = path.join(__dirname, '..', 'client', 'assets', 'install-identity.json');

function main() {
  const clientPkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));
  const build = clientPkg.build || {};
  const version = String(clientPkg.version || '0.0.0').trim();
  const productName = String(
    build.productName || `LIMSPLUS Connect ${version}`,
  ).trim();
  const appId = String(build.appId || 'com.limsplus.connect').trim();

  const identity = {
    appId,
    version,
    productName,
    buildId: crypto.randomUUID(),
    builtAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(identity, null, 2)}\n`);
  console.info(`[install-identity] ${identity.productName} ${identity.version} (${identity.buildId})`);
}

main();

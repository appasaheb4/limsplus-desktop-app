/**
 * Sets electron-builder display name to "LIMSPLUS Connect <version>" from client/package.json.
 * Run before electron-builder (production / build:mac / build:win).
 */
const fs = require('fs');
const path = require('path');

const clientPkgPath = path.join(__dirname, '..', 'client', 'package.json');

function main() {
  const clientPkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));
  const version = String(clientPkg.version || '0.0.0').trim();
  const productName = `LIMSPLUS Connect ${version}`;

  clientPkg.build = clientPkg.build || {};
  clientPkg.build.productName = productName;

  if (clientPkg.build.nsis) {
    clientPkg.build.nsis.shortcutName = productName;
  }
  if (clientPkg.build.dmg) {
    clientPkg.build.dmg.title = productName;
  }
  if (clientPkg.build.win) {
    clientPkg.build.win.artifactName = '${productName} Setup.${ext}';
  }
  if (clientPkg.build.dmg) {
    clientPkg.build.dmg.artifactName = '${productName}.${ext}';
  }

  fs.writeFileSync(clientPkgPath, `${JSON.stringify(clientPkg, null, 2)}\n`);
  console.info(`[productName] ${productName}`);
}

main();

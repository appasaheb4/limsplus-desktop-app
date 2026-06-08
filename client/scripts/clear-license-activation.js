/**
 * Removes local license activation so the activation key screen shows again.
 *
 * Dev (`yarn electron:dev`) uses package name → "limsplus-connect".
 * Packaged app uses productName → "LIMSPLUS Connect".
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const LICENSE_FILE = 'license-activation.secure';

function appSupportDir(folderName) {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', folderName);
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      folderName,
    );
  }
  return path.join(os.homedir(), '.config', folderName);
}

const folders = ['limsplus-connect', 'LimsPlus Connect', 'LIMSPLUS Connect'];
let removed = 0;

for (const folder of folders) {
  const filePath = path.join(appSupportDir(folder), LICENSE_FILE);
  if (!fs.existsSync(filePath)) continue;
  try {
    fs.unlinkSync(filePath);
    console.log(`Removed: ${filePath}`);
    removed += 1;
  } catch (err) {
    console.error(`Failed to remove ${filePath}:`, err.message);
    process.exitCode = 1;
  }
}

if (removed === 0) {
  console.log(
    `No ${LICENSE_FILE} found under:\n` +
      folders.map((f) => `  - ${appSupportDir(f)}`).join('\n'),
  );
} else {
  console.log(
    `Done. Restart the app (yarn electron:dev) to see the activation screen.`,
  );
}

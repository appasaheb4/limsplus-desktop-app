/**
 * Resets LIMSPLUS Lite first-time wizard state so the next click shows the
 * full setup steps popup and drops/re-imports MongoDB.
 *
 * Dev: ~/Library/Application Support/limsplus-connect/user-preferences.json
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

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

const PREFS_FILE = 'user-preferences.json';
const folders = ['limsplus-connect', 'LimsPlus Connect', 'LIMSPLUS Connect'];

const KEYS_TO_CLEAR = [
  'limsLiteSetupWizardComplete',
  'limsLiteFirstSetupComplete',
];

let updated = 0;

for (const folder of folders) {
  const prefsPath = path.join(appSupportDir(folder), PREFS_FILE);
  if (!fs.existsSync(prefsPath)) continue;
  try {
    const data = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
    let changed = false;
    for (const key of KEYS_TO_CLEAR) {
      if (key in data) {
        delete data[key];
        changed = true;
      }
    }
    if (data.limsOfflineDbRestored === true) {
      data.limsOfflineDbRestored = false;
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(prefsPath, JSON.stringify(data, null, 2));
      console.log(`Updated: ${prefsPath}`);
      updated += 1;
    } else {
      console.log(`No Lite wizard flags in: ${prefsPath}`);
    }
  } catch (err) {
    console.error(`Failed ${prefsPath}:`, err.message);
    process.exitCode = 1;
  }
}

if (updated === 0) {
  console.log(
    'No user-preferences.json updated. Paths checked:\n' +
      folders.map((f) => `  - ${path.join(appSupportDir(f), PREFS_FILE)}`).join('\n'),
  );
} else {
  console.log(
    'Done. Restart Electron, then click LIMSPLUS Lite — you should see the 6-step setup popup and a fresh DB import.',
  );
}

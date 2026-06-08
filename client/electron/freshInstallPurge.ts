/**
 * Packaged installs always start with empty local state (Mongo, prefs, activation cache, etc.).
 * Runs before Store / MessageStore read userData.
 */
import { app } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const INSTALL_STATE_BASENAME = '.lims-connect-install-state.json';
const BUNDLED_IDENTITY_BASENAME = 'install-identity.json';

const LEGACY_USER_DATA_DIR_NAMES = [
  'limsplus-connect',
  'LimsPlus Connect',
  'LIMSPLUS Connect',
] as const;

type BundledInstallIdentity = {
  appId: string;
  version: string;
  productName: string;
  buildId: string;
  builtAt: string;
};

type StoredInstallState = {
  buildId: string;
  appBinaryMtimeMs: number;
  productName: string;
  version: string;
  recordedAt: string;
};

function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function readBundledInstallIdentity(): BundledInstallIdentity | null {
  const candidates = [
    path.join(process.resourcesPath, BUNDLED_IDENTITY_BASENAME),
    path.join(process.resourcesPath, 'assets', BUNDLED_IDENTITY_BASENAME),
  ];
  for (const candidate of candidates) {
    const parsed = readJsonFile<Partial<BundledInstallIdentity>>(candidate);
    if (
      parsed &&
      typeof parsed.buildId === 'string' &&
      typeof parsed.version === 'string' &&
      typeof parsed.productName === 'string'
    ) {
      return {
        appId: String(parsed.appId || 'com.limsplus.connect'),
        version: parsed.version,
        productName: parsed.productName,
        buildId: parsed.buildId,
        builtAt: String(parsed.builtAt || ''),
      };
    }
  }
  return null;
}

function getPackagedAppBinaryMtimeMs(): number {
  try {
    return fs.statSync(process.execPath).mtimeMs;
  } catch {
    return 0;
  }
}

function appSupportParentDir(): string {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }
  if (process.platform === 'win32') {
    return (
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    );
  }
  return path.join(os.homedir(), '.config');
}

function localAppDataParentDir(): string | null {
  if (process.platform !== 'win32') return null;
  return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
}

function listLegacyProductDataDirs(): string[] {
  const roots = [appSupportParentDir()];
  const local = localAppDataParentDir();
  if (local) roots.push(local);

  const found = new Set<string>();
  for (const root of roots) {
    for (const legacyName of LEGACY_USER_DATA_DIR_NAMES) {
      found.add(path.join(root, legacyName));
    }
    try {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (
          /^LIMSPLUS Lite /i.test(entry.name) ||
          /^LIMSPLUS Connect /i.test(entry.name)
        ) {
          found.add(path.join(root, entry.name));
        }
      }
    } catch {
      /* ignore unreadable support roots */
    }
  }
  return [...found];
}

function removePathIfExists(targetPath: string): void {
  try {
    if (!fs.existsSync(targetPath)) return;
    fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 3 });
    console.info('[Fresh install] removed:', targetPath);
  } catch (err) {
    console.warn(
      '[Fresh install] could not remove path:',
      targetPath,
      err instanceof Error ? err.message : err,
    );
  }
}

function purgeDirectoryTree(targetPath: string): void {
  removePathIfExists(targetPath);
  try {
    fs.mkdirSync(targetPath, { recursive: true });
  } catch {
    /* ignore */
  }
}

function shouldPurgeForInstall(
  bundled: BundledInstallIdentity,
  stored: StoredInstallState | null,
  appBinaryMtimeMs: number,
): boolean {
  if (!stored) return true;
  if (stored.buildId !== bundled.buildId) return true;
  if (stored.appBinaryMtimeMs !== appBinaryMtimeMs) return true;
  return false;
}

function writeStoredInstallState(
  userDataPath: string,
  bundled: BundledInstallIdentity,
  appBinaryMtimeMs: number,
): void {
  const state: StoredInstallState = {
    buildId: bundled.buildId,
    appBinaryMtimeMs,
    productName: bundled.productName,
    version: bundled.version,
    recordedAt: new Date().toISOString(),
  };
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(
    path.join(userDataPath, INSTALL_STATE_BASENAME),
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8',
  );
}

function purgeAllKnownAppDataLocations(currentUserDataPath: string): void {
  const targets = new Set<string>([
    currentUserDataPath,
    ...listLegacyProductDataDirs(),
  ]);

  for (const electronPathKey of ['logs', 'sessionData'] as const) {
    try {
      targets.add(app.getPath(electronPathKey));
    } catch {
      /* ignore */
    }
  }

  for (const target of targets) {
    purgeDirectoryTree(target);
  }
}

/**
 * Clears all persisted app data when a new installer/build is detected.
 * Skipped in dev and when `LIMSPLUS_SKIP_FRESH_INSTALL_PURGE=1`.
 */
export function ensureFreshInstallOnPackagedStartup(): void {
  if (!app.isPackaged) return;
  if (process.env.LIMSPLUS_SKIP_FRESH_INSTALL_PURGE === '1') {
    console.info(
      '[Fresh install] purge skipped (LIMSPLUS_SKIP_FRESH_INSTALL_PURGE=1).',
    );
    return;
  }

  const bundled = readBundledInstallIdentity();
  if (!bundled) {
    console.warn(
      '[Fresh install] install-identity.json missing from resources — skipping purge.',
    );
    return;
  }

  const userDataPath = app.getPath('userData');
  const stored = readJsonFile<StoredInstallState>(
    path.join(userDataPath, INSTALL_STATE_BASENAME),
  );
  const appBinaryMtimeMs = getPackagedAppBinaryMtimeMs();

  if (!shouldPurgeForInstall(bundled, stored, appBinaryMtimeMs)) {
    return;
  }

  console.info(
    `[Fresh install] purging local app data for ${bundled.productName} ${bundled.version} (${bundled.buildId}).`,
  );
  purgeAllKnownAppDataLocations(userDataPath);
  writeStoredInstallState(userDataPath, bundled, appBinaryMtimeMs);
}

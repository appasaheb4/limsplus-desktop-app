import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { BSON, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
// adm-zip CommonJS (avoid @types/adm-zip vs Electron @types/node clashes)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdmZip = require('adm-zip');

const DEFAULT_LITE_DB_NAME = 'limsplus-prod';
const BSON_BATCH = 250;

/** Embedded mongod listens only here (loopback — not exposed on LAN). */
const LITE_MONGO_BIND_IP = '127.0.0.1';
const LITE_MONGO_PORT = 52701;

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

/** Version aligned with MongoDB 7 community line (mongodb-memory-server). */
const LITE_MONGO_BINARY_VERSION = '7.0.14';

function getLiteMongoDownloadDir(): string {
  const archSegment =
    process.arch === 'arm64'
      ? 'arm64'
      : process.arch === 'x64'
        ? 'x64'
        : process.arch;

  let osSegment: string;
  if (isWin) {
    osSegment = 'windows';
  } else if (isMac) {
    osSegment = process.arch === 'arm64' ? 'macos-arm64' : 'macos-x64';
  } else if (isLinux) {
    osSegment = `linux-${archSegment}`;
  } else {
    osSegment = process.platform;
  }

  const dir = path.join(
    app.getPath('userData'),
    'mongodb-memory-downloads',
    osSegment,
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function findSystemMongodOnDarwin(): string | undefined {
  const candidates = ['/opt/homebrew/bin/mongod', '/usr/local/bin/mongod'];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore access errors */
    }
  }
  return undefined;
}

function findSystemMongodOnWindows(): string | undefined {
  const bases = [
    process.env.PROGRAMFILES,
    process.env['PROGRAMFILES(X86)'],
    'C:\\Program Files',
    'C:\\Program Files (x86)',
  ].filter((b): b is string => Boolean(b));

  const seen = new Set<string>();

  for (const root of bases) {
    const mongoRoot = path.join(root, 'MongoDB');
    if (seen.has(mongoRoot)) continue;
    seen.add(mongoRoot);
    try {
      if (!fs.existsSync(mongoRoot)) continue;
      for (const versionDir of fs.readdirSync(mongoRoot)) {
        const candidate = path.join(
          mongoRoot,
          versionDir,
          'bin',
          'mongod.exe',
        );
        if (fs.existsSync(candidate)) return candidate;
      }
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function findSystemMongodOnLinux(): string | undefined {
  const candidates = ['/usr/bin/mongod', '/usr/local/bin/mongod'];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function resolveBundledSystemMongodBinary(): string | undefined {
  if (isMac) return findSystemMongodOnDarwin();
  if (isWin) return findSystemMongodOnWindows();
  if (isLinux) return findSystemMongodOnLinux();
  return undefined;
}

/**
 * Homebrew / system mongod often mismatches the MMS-requested version and fails
 * with exit code 2. Default: use the binary MMS downloads (matches LITE_MONGO_BINARY_VERSION).
 * Opt-in: set env LIMSPLUS_USE_SYSTEM_MONGOD=1 to try a local mongod (advanced).
 */
function shouldUseSystemMongod(): boolean {
  return process.env.LIMSPLUS_USE_SYSTEM_MONGOD === '1';
}

/**
 * OS-specific MongoMemoryServer options.
 *
 * SECURITY: `instance.ip` is loopback only — Mongo does not bind to every
 * interface; other computers cannot reach port LITE_MONGO_PORT over the LAN.
 *
 * Do not pass extra `--bind_ip` args — MMS already adds `--bind_ip` from
 * `instance.ip`; duplicates cause mongod exit code 2.
 */
function buildLiteMongoMemoryServerConfig(dbPath: string) {
  const systemPath = resolveBundledSystemMongodBinary();
  const systemBinary =
    shouldUseSystemMongod() && systemPath ? systemPath : undefined;

  const startupTimeoutMs = isWin ? 180_000 : 120_000;

  return {
    binary: {
      version: LITE_MONGO_BINARY_VERSION,
      downloadDir: getLiteMongoDownloadDir(),
      ...(systemBinary ? { systemBinary } : {}),
    },
    instance: {
      dbPath,
      ip: LITE_MONGO_BIND_IP,
      port: LITE_MONGO_PORT,
      launchTimeout: startupTimeoutMs,
    },
  };
}

/** Debugging aid when diagnosing packaged macOS / Windows builds. */
export function getLiteMongoPlatformSummary(): {
  platform: NodeJS.Platform;
  arch: string;
  bindIp: string;
  mongoPort: number;
  downloadCacheHint: string;
  systemMongodDetected: string | null;
  usingSystemMongod: boolean;
  networkScopeNote: string;
} {
  const detected = resolveBundledSystemMongodBinary() ?? null;
  return {
    platform: process.platform,
    arch: process.arch,
    bindIp: LITE_MONGO_BIND_IP,
    mongoPort: LITE_MONGO_PORT,
    downloadCacheHint: path.join(
      app.getPath('userData'),
      'mongodb-memory-downloads',
    ),
    systemMongodDetected: detected,
    usingSystemMongod: Boolean(shouldUseSystemMongod() && detected),
    networkScopeNote:
      'MongoDB listens only on loopback — not reachable from LAN/WAN.',
  };
}

export const LIMS_LITE_MONGO_LOOPBACK_BIND = LITE_MONGO_BIND_IP;
export const LIMS_LITE_MONGO_FIXED_PORT = LITE_MONGO_PORT;

/**
 * Skip embedded MongoDB Memory Server — use existing mongod / Atlas-style URI instead
 * (same idea as backend `MONGODB_URL_LOCAL`).
 *
 * Env: **`LIMSPLUS_LITE_EXTERNAL_MONGO_URI`** or **`LIMSPLUS_LITE_LOCAL_MONGO_URI`**.
 * Example: `mongodb://127.0.0.1:27017/limsplus-prod`
 */
export function getLiteExternalMongoUriFromEnv(): string | null {
  const raw =
    process.env.LIMSPLUS_LITE_EXTERNAL_MONGO_URI?.trim() ||
    process.env.LIMSPLUS_LITE_LOCAL_MONGO_URI?.trim();
  return raw?.length ? raw : null;
}

/** Hide `user:pass@` in Mongo URIs for logs / UI. */
export function redactMongoUriForLogs(uri: string): string {
  try {
    return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  } catch {
    return '(mongo)';
  }
}

export type RestoreDumpResult =
  | { didRestore: true; databaseName: string }
  | { didRestore: false; databaseName: string };

/** mongodb-memory-server process; WiredTiger files live under dbPath below. */
let memoryServer: MongoMemoryServer | null = null;

function getMongoDataPath(): string {
  return path.join(app.getPath('userData'), 'lims-lite-mongodb');
}

export async function stopLiteMongoServer(): Promise<void> {
  if (memoryServer) {
    try {
      await memoryServer.stop({
        force: false,
        doCleanup: false,
      });
    } catch (e) {
      console.error('offlineLimsLite: stop mongo', e);
    }
    memoryServer = null;
  }
}

export function isLiteMongoServerActive(): boolean {
  return memoryServer !== null;
}

/** Start persisted embedded mongod once per app session (reuse data dir between runs). */
export async function ensureLiteMongoRunning(): Promise<string> {
  if (!memoryServer) {
    const dbPath = getMongoDataPath();
    fs.mkdirSync(dbPath, { recursive: true });
    memoryServer = await MongoMemoryServer.create(
      buildLiteMongoMemoryServerConfig(dbPath),
    );
  }
  return memoryServer.getUri();
}

/**
 * MongoMemoryServer can return a URI before `mongod` accepts TCP. Waits until
 * `{ ping: 1 }` succeeds so restore / Nest never run against a silent server.
 */
export async function waitUntilLiteMongoAcceptsConnections(
  mongoUri: string,
  explicitTimeoutMs?: number,
): Promise<void> {
  const fromEnv = Number.parseInt(
    process.env.LIMS_LITE_MONGO_PING_TIMEOUT_MS ?? '',
    10,
  );
  const limit =
    explicitTimeoutMs ??
    (Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 120_000);
  const deadline = Date.now() + limit;

  while (Date.now() < deadline) {
    let client: MongoClient | undefined;
    try {
      client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 2000 });
      await client.connect();
      await client.db('admin').command({ ping: 1 });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 450));
    } finally {
      await client?.close().catch(() => undefined);
    }
  }

  throw new Error(
    `MongoDB did not accept connections within ${limit}ms. First launch binary download / disk may be slow — retry or set LIMS_LITE_MONGO_PING_TIMEOUT_MS.`,
  );
}

function bsonFileToDocuments(filePath: string): Record<string, unknown>[] {
  const buf = fs.readFileSync(filePath);
  const docs: Record<string, unknown>[] = [];
  let offset = 0;
  while (offset < buf.length) {
    if (buf.length - offset < 5) break;
    const bsonSize = buf.readInt32LE(offset);
    if (bsonSize < 5 || bsonSize > buf.length - offset) {
      throw new Error(`Invalid BSON size at offset ${offset} in ${filePath}`);
    }
    const slice = buf.subarray(offset, offset + bsonSize);
    docs.push(BSON.deserialize(slice) as Record<string, unknown>);
    offset += bsonSize;
  }
  return docs;
}

/** Find a directory that directly contains at least one .bson collection file. */
function findBsonDumpRoot(searchDir: string): string | null {
  const entries = fs.readdirSync(searchDir, { withFileTypes: true });
  const hasBson = entries.some((e) => e.isFile() && e.name.endsWith('.bson'));
  if (hasBson) return searchDir;
  for (const e of entries) {
    if (e.isDirectory()) {
      const nested = findBsonDumpRoot(path.join(searchDir, e.name));
      if (nested) return nested;
    }
  }
  return null;
}

/** Restore archive or folder dump into mongo (drops target DB first). */
export async function restoreLiteDatabaseDump(
  mongoUri: string,
  dumpFolder: string,
  dbName: string,
): Promise<void> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  try {
    const db = client.db(dbName);
    await db.dropDatabase().catch(() => undefined);

    const files = fs.readdirSync(dumpFolder).filter((f) => {
      const lower = f.toLowerCase();
      return lower.endsWith('.bson') && !lower.startsWith('.');
    });

    files.sort();

    for (const file of files) {
      const collName = path.basename(file, '.bson');
      if (!collName) continue;
      const full = path.join(dumpFolder, file);
      let docs = bsonFileToDocuments(full);

      /** Metadata collections are empty in many dumps — skip noop. */
      if (docs.length === 0) continue;

      /** Optional: prelude / system collections */
      const coll = db.collection(collName);

      while (docs.length > 0) {
        const batch = docs.slice(0, BSON_BATCH);
        docs = docs.slice(BSON_BATCH);
        await coll.insertMany(batch, { ordered: false });
      }
    }
  } finally {
    await client.close().catch(() => undefined);
  }
}

function extractZip(zipPath: string, targetDir: string): void {
  fs.mkdirSync(targetDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(targetDir, true);
}

/** Prefer ZIP if present; otherwise use extracted dump folder (dev fallback). */
export function resolveDatabaseDumpFolder(options: {
  zipPath?: string | null;
  folderPath?: string | null;
}): string {
  const unpackRoot = path.join(
    app.getPath('userData'),
    'offline-dump-extract',
  );
  fs.rmSync(unpackRoot, { recursive: true, force: true });
  fs.mkdirSync(unpackRoot, { recursive: true });

  if (options.zipPath != null && fs.existsSync(options.zipPath)) {
    extractZip(options.zipPath, unpackRoot);
  } else if (
    options.folderPath != null &&
    fs.existsSync(options.folderPath)
  ) {
    fs.cpSync(options.folderPath, unpackRoot, { recursive: true });
  } else {
    throw new Error(
      'No MongoDB backup found. Expected limsplus-prod.zip or database/limsplus-prod folder.',
    );
  }

  let bsonRoot = findBsonDumpRoot(unpackRoot);
  if (!bsonRoot) {
    const children = fs.readdirSync(unpackRoot, { withFileTypes: true });
    for (const c of children) {
      if (c.isDirectory()) {
        bsonRoot = findBsonDumpRoot(path.join(unpackRoot, c.name));
        if (bsonRoot) break;
      }
    }
  }

  if (!bsonRoot) {
    throw new Error('Backup ZIP did not contain any .bson collection files.');
  }
  return bsonRoot;
}

export function liteDbNameFromDumpPath(dumpFolder: string): string {
  const base = path.basename(path.resolve(dumpFolder));
  if (base && base !== '.' && base !== '/') return base;
  return DEFAULT_LITE_DB_NAME;
}

export async function restoreFromBundledDumpIfNeeded(
  mongoUri: string,
  isAlreadyRestored: boolean,
): Promise<RestoreDumpResult> {
  if (isAlreadyRestored) {
    return {
      didRestore: false,
      databaseName: DEFAULT_LITE_DB_NAME,
    };
  }

  const zipCandidates = [
    path.join(process.resourcesPath, 'database', 'limsplus-prod.zip'),
    path.join(app.getAppPath(), 'database', 'limsplus-prod.zip'),
  ];
  const zipPath = zipCandidates.find((p) => fs.existsSync(p));

  const dirCandidates = [
    path.join(process.resourcesPath, 'database', 'limsplus-prod'),
    path.join(app.getAppPath(), 'database', 'limsplus-prod'),
  ];
  const folderPath = dirCandidates.find((p) => fs.existsSync(p));

  const dumpFolder = resolveDatabaseDumpFolder({ zipPath, folderPath });
  const dbName = liteDbNameFromDumpPath(dumpFolder);

  await restoreLiteDatabaseDump(mongoUri, dumpFolder, dbName);
  return { didRestore: true, databaseName: dbName };
}

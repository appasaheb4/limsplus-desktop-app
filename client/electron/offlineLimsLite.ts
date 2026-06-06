import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { EJSON } from 'bson';
import { BSON, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { resolveExclusiveLoopbackTcpPort } from './exclusiveLoopbackTcpPort';
// adm-zip CommonJS (avoid @types/adm-zip vs Electron @types/node clashes)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdmZip = require('adm-zip');

export const DEFAULT_LITE_DB_NAME = 'limsplus-prod';

export type LiteDumpRestoreProgress = {
  collectionName: string;
  collectionIndex: number;
  collectionTotal: number;
  documentsInCollection: number;
  documentsInsertedTotal: number;
};
const BSON_BATCH = 250;

/** Embedded mongod listens only here (loopback — not exposed on LAN). */
const LITE_MONGO_BIND_IP = '127.0.0.1';

/** Default embedded `mongod` TCP (**27017**). If busy, Lite stops other listeners on that port unless **`LIMSPLUS_LITE_DO_NOT_KILL_OCCUPIED_MONGO_PORT=1`**. */
export const LIMS_LITE_MONGO_DEFAULT_PREFERRED_PORT = 27017;

/**
 * Stable default for docs / diagnostics only (same as {@link LIMS_LITE_MONGO_DEFAULT_PREFERRED_PORT}).
 */
export const LIMS_LITE_MONGO_FIXED_PORT =
  LIMS_LITE_MONGO_DEFAULT_PREFERRED_PORT;

export type EmbeddedLiteMongoReady = {
  mongoUri: string;
  listenPort: number;
};

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
 * interface; other computers cannot reach chosen `instance.port` over the LAN.
 *
 * Do not pass extra `--bind_ip` args — MMS already adds `--bind_ip` from
 * `instance.ip`; duplicates cause mongod exit code 2.
 */
function buildLiteMongoMemoryServerConfig(
  dbPath: string,
  tcpPort: number,
  opts?: { forceSystemBinary?: string },
) {
  let systemBinary: string | undefined;
  if (opts?.forceSystemBinary) {
    systemBinary = opts.forceSystemBinary;
  } else if (shouldUseSystemMongod()) {
    const systemPath = resolveBundledSystemMongodBinary();
    if (systemPath) systemBinary = systemPath;
  }

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
      port: tcpPort,
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
  mongoEmbeddedRetriedSystemMongod: boolean;
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
    mongoPort: memoryServer
      ? embeddedMongoListenTcpPort
      : LIMS_LITE_MONGO_DEFAULT_PREFERRED_PORT,
    mongoEmbeddedRetriedSystemMongod: embeddedMongoViaSystemFallback,
    downloadCacheHint: path.join(
      app.getPath('userData'),
      'mongodb-memory-downloads',
    ),
    systemMongodDetected: detected,
    usingSystemMongod:
      embeddedMongoViaSystemFallback ||
      Boolean(shouldUseSystemMongod() && detected),
    networkScopeNote:
      'MongoDB listens only on loopback — not reachable from LAN/WAN.',
  };
}

export const LIMS_LITE_MONGO_LOOPBACK_BIND = LITE_MONGO_BIND_IP;

/** Best-effort TCP port embedded in standard `mongodb://…` URIs (`null` for `mongodb+srv`, etc.). */
export function mongoTcpListenPortHint(uri: string): number | null {
  try {
    if (/^mongodb\+srv:/i.test(uri)) return null;
    const stripped = uri.split('?')[0].replace(/^mongodb:/i, 'http:');
    const u = new URL(stripped);
    const raw = u.port;
    const p = raw ? Number.parseInt(raw, 10) : 27017;
    return Number.isFinite(p) ? p : null;
  } catch {
    return null;
  }
}

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
/** TCP port MMS bound for this session (`0` until first embedded start). */
let embeddedMongoListenTcpPort = 0;
/** True when MMS bundled binary failed and we retried with a detected system `mongod`. */
let embeddedMongoViaSystemFallback = false;

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
    embeddedMongoListenTcpPort = 0;
    embeddedMongoViaSystemFallback = false;
  }
}

export function isLiteMongoServerActive(): boolean {
  return memoryServer !== null;
}

/**
 * **`LIMS_LITE_MONGO_PORT`** when set, else **27017**. **`auto`** / **`0`** → ephemeral.
 * Unless **`LIMSPLUS_LITE_DO_NOT_KILL_OCCUPIED_MONGO_PORT=1`**, stops other listeners on that port.
 */
async function resolveEmbeddedMongoListenPort(): Promise<number> {
  const skipKill =
    process.env.LIMSPLUS_LITE_DO_NOT_KILL_OCCUPIED_MONGO_PORT === '1' ||
    process.env.LIMSPLUS_LITE_DO_NOT_KILL_OCCUPIED_MONGO_PORT === 'true';

  return resolveExclusiveLoopbackTcpPort({
    rawPortEnv: process.env.LIMS_LITE_MONGO_PORT,
    defaultPort: LIMS_LITE_MONGO_DEFAULT_PREFERRED_PORT,
    skipKillOccupiers: skipKill,
    roleLabel: 'MongoDB',
    portEnvVarName: 'LIMS_LITE_MONGO_PORT',
    skipKillEnvVarName: 'LIMSPLUS_LITE_DO_NOT_KILL_OCCUPIED_MONGO_PORT',
  });
}

/** Start persisted embedded mongod once per app session (reuse data dir between runs). */
export async function ensureLiteMongoRunning(): Promise<EmbeddedLiteMongoReady> {
  if (!memoryServer) {
    const dbPath = getMongoDataPath();
    fs.mkdirSync(dbPath, { recursive: true });
    const port = await resolveEmbeddedMongoListenPort();
    embeddedMongoListenTcpPort = port;
    embeddedMongoViaSystemFallback = false;

    try {
      memoryServer = await MongoMemoryServer.create(
        buildLiteMongoMemoryServerConfig(dbPath, port),
      );
    } catch (firstErr) {
      const details =
        firstErr instanceof Error ? firstErr.message : String(firstErr);
      const sys = resolveBundledSystemMongodBinary();

      if (!shouldUseSystemMongod() && sys) {
        console.warn(
          '[LimsPlus Lite] Embedded Mongo (downloaded MMS binary) failed; retrying once with local mongod:',
          details,
          'binary:',
          sys,
        );
        embeddedMongoViaSystemFallback = true;
        memoryServer = await MongoMemoryServer.create(
          buildLiteMongoMemoryServerConfig(dbPath, port, {
            forceSystemBinary: sys,
          }),
        );
      } else {
        throw new Error(
          `Embedded Mongo failed: ${details}\n\nTry one of:\n• Start MongoDB locally, then export LIMSPLUS_LITE_EXTERNAL_MONGO_URI=mongodb://127.0.0.1:27017/${DEFAULT_LITE_DB_NAME}\n• Set LIMSPLUS_USE_SYSTEM_MONGOD=1 to force mongodb-memory-server to use Homebrew/System mongod (detected: ${sys ?? 'none'}).`,
        );
      }
    }
  }
  return {
    mongoUri: memoryServer.getUri(),
    listenPort: embeddedMongoListenTcpPort,
  };
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
    `MongoDB did not accept connections within ${limit}ms. First launch binary download / disk may be slow — increase LIMS_LITE_MONGO_PING_TIMEOUT_MS.\nAlternatively use local mongod: LIMSPLUS_LITE_EXTERNAL_MONGO_URI, or embedded retry: LIMSPLUS_USE_SYSTEM_MONGOD=1.`,
  );
}

function isMongoLeafBsonDumpFile(fname: string): boolean {
  if (fname.startsWith('.')) return false;
  const ll = fname.toLowerCase();
  if (ll.endsWith('.bson.gz')) return true;
  return ll.endsWith('.bson') && !ll.endsWith('.bson.gz');
}

function readMongoLeafBsonFileBuffer(fileAbsPath: string): Buffer {
  const raw = fs.readFileSync(fileAbsPath);
  const ll = fileAbsPath.toLowerCase();
  if (ll.endsWith('.bson.gz')) {
    try {
      return zlib.gunzipSync(raw);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Gunzip failed for ${fileAbsPath}: ${msg} (mongodump --gzip .bson.gz? Corrupt ZIP?)`,
      );
    }
  }
  return raw;
}

/** Multi-document bson file parsing (classic mongorestore `--dir` dumps). */
function bsonDocumentsFromBuffer(
  buf: Buffer,
  diagnosticLabel: string,
): Record<string, unknown>[] {
  const docs: Record<string, unknown>[] = [];
  let offset = 0;
  while (offset < buf.length) {
    if (buf.length - offset < 5) break;
    const bsonSize = buf.readInt32LE(offset);
    if (bsonSize < 5 || bsonSize > buf.length - offset) {
      throw new Error(
        `[LimsPlus Lite] Invalid BSON framing (size=${bsonSize} at byte ${offset}) in "${diagnosticLabel}". If this came from gzip, verify .bson.gz; plain mongorestore archives are different from bson directory dumps.`,
      );
    }
    const slice = buf.subarray(offset, offset + bsonSize);
    docs.push(BSON.deserialize(slice) as Record<string, unknown>);
    offset += bsonSize;
  }
  return docs;
}

/**
 * Map dump path → collection name (`sub/cols.bson` → `sub.cols`; supports gzip).
 * Matches mongo directory layout nesting under db folder root.
 */
function collectionNameFromMongoDumpPath(
  dumpRootAbs: string,
  bsonFileAbs: string,
): string {
  let rel = path.relative(dumpRootAbs, bsonFileAbs);
  if (rel.startsWith(`..${path.sep}`)) {
    throw new Error(
      `[LimsPlus Lite] Dump path escapes root: dumpRoot="${dumpRootAbs}" file="${bsonFileAbs}"`,
    );
  }
  rel = rel.split(path.sep).join('/');
  return rel.replace(/\.(bson\.gz|bson)$/i, '').split('/').join('.');
}

type MongodumpMetadataFile = {
  collectionName?: string;
  type?: string;
  options?: {
    viewOn?: string;
    pipeline?: unknown[];
  };
};

function recursivelyCollectMetadataJsonFiles(absDirRoot: string): string[] {
  const out: string[] = [];

  function walk(abs: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const pAbs = path.join(abs, e.name);
      if (e.isDirectory()) {
        walk(pAbs);
      } else if (e.name.endsWith('.metadata.json')) {
        out.push(pAbs);
      }
    }
  }

  walk(absDirRoot);
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * BSON import skips `*.metadata.json` views (e.g. `delivery_queue_deduped` on `patientReports`).
 * Delivery-queue reads that view — recreate it after every restore (Mac + Windows).
 */
async function restoreMongoViewsFromDumpMetadata(
  db: import('mongodb').Db,
  dumpFolder: string,
): Promise<string[]> {
  const dumpRootResolved = path.resolve(dumpFolder);
  const metadataPaths = recursivelyCollectMetadataJsonFiles(dumpRootResolved);
  const viewsCreated: string[] = [];

  for (const metaPath of metadataPaths) {
    let meta: MongodumpMetadataFile;
    try {
      meta = EJSON.parse(
        fs.readFileSync(metaPath, 'utf8'),
      ) as MongodumpMetadataFile;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        '[LimsPlus Lite] Skipping unreadable view metadata:',
        metaPath,
        msg,
      );
      continue;
    }

    if (meta.type !== 'view') continue;

    const viewName = meta.collectionName?.trim();
    const viewOn = meta.options?.viewOn?.trim();
    const pipeline = meta.options?.pipeline;
    if (
      !viewName ||
      !viewOn ||
      !Array.isArray(pipeline) ||
      pipeline.length === 0
    ) {
      console.warn(
        '[LimsPlus Lite] Skipping incomplete view metadata:',
        metaPath,
      );
      continue;
    }

    try {
      const existing = await db
        .listCollections({ name: viewName }, { nameOnly: true })
        .toArray();
      if (existing.length > 0) {
        await db.collection(viewName).drop().catch(() => undefined);
      }
      await db.createCollection(viewName, {
        viewOn,
        pipeline: pipeline as import('mongodb').Document[],
      });
      viewsCreated.push(viewName);
      console.info(
        `[LimsPlus Lite] MongoDB view created: ${viewName} → ${viewOn}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[LimsPlus Lite] Failed to create MongoDB view "${viewName}" from ${metaPath}: ${msg}`,
      );
    }
  }

  return viewsCreated;
}

/** Ensures mongodump views exist when BSON import was skipped (e.g. prior Windows seed without views). */
async function ensureBundledMongoViews(
  mongoUri: string,
  databaseName: string,
  options: { folderPath?: string; zipPath?: string },
): Promise<void> {
  let metadataRoot: string | null = null;
  if (options.folderPath && fs.existsSync(options.folderPath)) {
    metadataRoot =
      findFirstBsonHierarchyRoot(options.folderPath) ?? options.folderPath;
  } else if (options.zipPath && fs.existsSync(options.zipPath)) {
    metadataRoot = resolveDatabaseDumpFolder({
      zipPath: options.zipPath,
      folderPath: null,
    });
  }
  if (!metadataRoot) return;

  const client = new MongoClient(mongoUri);
  await client.connect();
  try {
    const db = client.db(databaseName);
    await restoreMongoViewsFromDumpMetadata(db, metadataRoot);
    await logDeliveryQueueRestoreDiagnostics(db);
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function logDeliveryQueueRestoreDiagnostics(
  db: import('mongodb').Db,
): Promise<void> {
  try {
    const deliveryQueueDocs = await db
      .collection('patientReports')
      .countDocuments({ documentType: 'deliveryQueue' });
    let viewRows: number | null = null;
    const viewExists =
      (
        await db
          .listCollections({ name: 'delivery_queue_deduped' }, { nameOnly: true })
          .toArray()
      ).length > 0;
    if (viewExists) {
      viewRows = await db.collection('delivery_queue_deduped').countDocuments();
    }
    console.info('[LimsPlus Lite] delivery-queue seed check:', {
      patientReportsDeliveryQueue: deliveryQueueDocs,
      deliveryQueueDedupedViewExists: viewExists,
      deliveryQueueDedupedViewRows: viewRows,
    });
  } catch (err: unknown) {
    console.warn(
      '[LimsPlus Lite] delivery-queue diagnostics skipped:',
      err instanceof Error ? err.message : err,
    );
  }
}

function recursivelyCollectMongoDumpLeafBson(absDirRoot: string): string[] {
  const out: string[] = [];

  function walk(abs: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const pAbs = path.join(abs, e.name);
      if (e.isDirectory()) {
        walk(pAbs);
      } else if (isMongoLeafBsonDumpFile(e.name)) {
        out.push(pAbs);
      }
    }
  }

  walk(absDirRoot);
  return out.sort((a, b) => a.localeCompare(b));
}

export function findFirstBsonHierarchyRoot(directoryAbsPath: string): string | null {
  let bsonRoot = findBsonDumpRoot(directoryAbsPath);
  if (!bsonRoot) {
    const children = fs.readdirSync(directoryAbsPath, { withFileTypes: true });
    for (const c of children) {
      if (c.isDirectory()) {
        bsonRoot = findBsonDumpRoot(path.join(directoryAbsPath, c.name));
        if (bsonRoot) break;
      }
    }
  }
  return bsonRoot;
}

function sumMongoDumpLeafArtifactStats(dumpRootAbs: string): {
  totalStoredBytes: number;
  newestMtimeMs: number;
} {
  const leaves = recursivelyCollectMongoDumpLeafBson(dumpRootAbs);
  let totalStoredBytes = 0;
  let newestMtime = Math.trunc(fs.statSync(dumpRootAbs).mtimeMs);
  for (const p of leaves) {
    totalStoredBytes += fs.statSync(p).size;
    newestMtime = Math.max(newestMtime, Math.trunc(fs.statSync(p).mtimeMs));
  }
  return { totalStoredBytes, newestMtimeMs: newestMtime };
}

/** Persists bundled backup identity so replacing limsplus-prod.zip retriggers restore. */
const LITE_ARTIFACT_MARKER_BASENAME = 'lite-bundled-restore-artifact-marker.json';

export type LiteBundledRestoreArtifactFingerprint = {
  artifactKind: 'zip' | 'folder';
  /** Resolved path on disk (`zip` or dump folder containing / wrapping .bson). */
  artifactResolvedPath: string;
  artifactMtimeMs: number;
  artifactSizeBytes: number;
  lastDatabaseName: string;
};

function liteArtifactMarkerAbsolutePath(): string {
  return path.join(app.getPath('userData'), LITE_ARTIFACT_MARKER_BASENAME);
}

export function readLiteBundledRestoreArtifactFingerprint():
  | LiteBundledRestoreArtifactFingerprint
  | null {
  try {
    const fp = liteArtifactMarkerAbsolutePath();
    if (!fs.existsSync(fp)) return null;
    const raw = fs.readFileSync(fp, 'utf8');
    const o = JSON.parse(raw) as Partial<LiteBundledRestoreArtifactFingerprint>;
    if (
      (o.artifactKind !== 'zip' && o.artifactKind !== 'folder') ||
      typeof o.artifactResolvedPath !== 'string' ||
      typeof o.artifactMtimeMs !== 'number' ||
      typeof o.artifactSizeBytes !== 'number'
    ) {
      return null;
    }
    return {
      artifactKind: o.artifactKind,
      artifactResolvedPath: o.artifactResolvedPath,
      artifactMtimeMs: o.artifactMtimeMs,
      artifactSizeBytes: o.artifactSizeBytes,
      lastDatabaseName:
        typeof o.lastDatabaseName === 'string' &&
        o.lastDatabaseName.trim().length > 0
          ? o.lastDatabaseName.trim()
          : DEFAULT_LITE_DB_NAME,
    };
  } catch {
    return null;
  }
}

export function writeLiteBundledRestoreArtifactFingerprint(
  m: LiteBundledRestoreArtifactFingerprint,
): void {
  try {
    fs.writeFileSync(
      liteArtifactMarkerAbsolutePath(),
      JSON.stringify(m, null, 2),
      'utf8',
    );
  } catch (e: unknown) {
    console.warn(
      '[LimsPlus Lite] could not write bundled restore fingerprint marker:',
      e,
    );
  }
}

function fingerprintZip(zipPathAbs: string): LiteBundledRestoreArtifactFingerprint {
  const st = fs.statSync(zipPathAbs);
  return {
    artifactKind: 'zip',
    artifactResolvedPath: path.resolve(zipPathAbs),
    artifactMtimeMs: Math.trunc(st.mtimeMs),
    artifactSizeBytes: st.size,
    lastDatabaseName: '',
  };
}

function fingerprintFolderDump(
  folderPathAbs: string,
): LiteBundledRestoreArtifactFingerprint {
  const bsonRoot = findFirstBsonHierarchyRoot(folderPathAbs);
  let totalBson = 0;
  let maxMtime = Math.trunc(fs.statSync(folderPathAbs).mtimeMs);
  if (bsonRoot) {
    const { totalStoredBytes, newestMtimeMs } =
      sumMongoDumpLeafArtifactStats(bsonRoot);
    totalBson = totalStoredBytes;
    maxMtime = Math.max(maxMtime, newestMtimeMs);
  }

  return {
    artifactKind: 'folder',
    artifactResolvedPath: path.resolve(folderPathAbs),
    artifactMtimeMs: maxMtime,
    artifactSizeBytes: totalBson,
    lastDatabaseName: '',
  };
}

function bundledArtifactFingerprintsMatch(
  a: LiteBundledRestoreArtifactFingerprint,
  b: LiteBundledRestoreArtifactFingerprint,
): boolean {
  return (
    a.artifactKind === b.artifactKind &&
    path.normalize(path.resolve(a.artifactResolvedPath)) ===
      path.normalize(path.resolve(b.artifactResolvedPath)) &&
    a.artifactMtimeMs === b.artifactMtimeMs &&
    a.artifactSizeBytes === b.artifactSizeBytes
  );
}

/** Locate a subdirectory that owns mongorestore bson leaf files (recursive). */
function findBsonDumpRoot(searchDir: string): string | null {
  const entries = fs.readdirSync(searchDir, { withFileTypes: true });
  const hasLeafHere = entries.some(
    (e) => e.isFile() && isMongoLeafBsonDumpFile(e.name),
  );
  if (hasLeafHere) return searchDir;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const nested = findBsonDumpRoot(path.join(searchDir, e.name));
    if (nested) return nested;
  }
  return null;
}

/**
 * Mongorestore **directory** format: `collection.bson` or `mongodump --gzip` **`*.bson.gz`** (possibly nested dirs).
 * Not supported: **`mongorestore --archive=file`** prelude stream (different binary layout).
 */
export async function restoreLiteDatabaseDump(
  mongoUri: string,
  dumpFolder: string,
  dbName: string,
  onProgress?: (p: LiteDumpRestoreProgress) => void,
): Promise<{ documentsInserted: number; collectionsRestored: number }> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  try {
    const db = client.db(dbName);
    await db.dropDatabase().catch(() => undefined);

    const dumpRootResolved = path.resolve(dumpFolder);
    const bsonPaths = recursivelyCollectMongoDumpLeafBson(dumpRootResolved);

    if (bsonPaths.length === 0) {
      throw new Error(
        'No *.bson or *.bson.gz files found in the selected folder. Use a mongodump-style directory (e.g. limsplus-prod/*.bson), not a single archive stream.',
      );
    }

    let documentsInserted = 0;
    const collectionsWithDocs = new Set<string>();
    const collectionTotal = bsonPaths.length;
    let collectionIndex = 0;

    for (const fullPath of bsonPaths) {
      collectionIndex += 1;
      const collName = collectionNameFromMongoDumpPath(
        dumpRootResolved,
        fullPath,
      );
      if (!collName) continue;

      let docs: Record<string, unknown>[];
      try {
        docs = bsonDocumentsFromBuffer(
          readMongoLeafBsonFileBuffer(fullPath),
          fullPath,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `[LimsPlus Lite] BSON decode failed — ${fullPath}: ${msg}`,
        );
      }

      if (docs.length === 0) continue;

      onProgress?.({
        collectionName: collName,
        collectionIndex,
        collectionTotal,
        documentsInCollection: docs.length,
        documentsInsertedTotal: documentsInserted,
      });

      collectionsWithDocs.add(collName);
      documentsInserted += docs.length;
      const coll = db.collection(collName);
      let remaining = docs;

      while (remaining.length > 0) {
        const batch = remaining.slice(0, BSON_BATCH);
        remaining = remaining.slice(BSON_BATCH);
        await coll.insertMany(batch, { ordered: false });
      }
    }

    if (documentsInserted === 0) {
      throw new Error(
        `Parsed 0 documents from ${bsonPaths.length} BSON file(s). Check gzip layout or folder structure.`,
      );
    }

    const viewsCreated = await restoreMongoViewsFromDumpMetadata(
      db,
      dumpRootResolved,
    );
    await logDeliveryQueueRestoreDiagnostics(db);

    console.info('[LimsPlus Lite] mongorestore-directory import:', {
      databaseName: dbName,
      bsonLeafFiles: bsonPaths.length,
      documentsInserted,
      collectionsPopulation: collectionsWithDocs.size,
      viewsCreated,
    });
    return {
      documentsInserted,
      collectionsRestored: collectionsWithDocs.size,
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}

function extractZip(zipPath: string, targetDir: string): void {
  fs.mkdirSync(targetDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(targetDir, true);
}

function dedupeOrderedPaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    const n = path.normalize(p);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * Path to **`client/database`** when running dev compiled Electron (`build/electron` → two levels up).
 * Packaged apps use **`process.resourcesPath/database`** instead; see {@link restoreFromBundledDumpIfNeeded}.
 */
export function getLiteBundledDatabaseDirectory(): string {
  return path.join(__dirname, '../../database');
}

/** Copy ZIP or a loose mongodump folder (`database/dump`, etc.) into `offline-dump-extract`, then find BSON roots. */
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
      'No MongoDB backup to extract. Provide database/dump folder, database/limsplus-prod/, or limsplus-prod.zip.',
    );
  }

  const bsonRoot = findFirstBsonHierarchyRoot(unpackRoot);

  if (!bsonRoot) {
    throw new Error(
      'Mongo dump contains no BSON leaf files (*.bson / *.bson.gz under extract root).',
    );
  }
  return bsonRoot;
}

export function liteDbNameFromDumpPath(dumpFolder: string): string {
  const base = path.basename(path.resolve(dumpFolder));
  if (base && base !== '.' && base !== '/') return base;
  return DEFAULT_LITE_DB_NAME;
}

/**
 * Forces a bundled restore even when the **`limsplus-prod`** artifact fingerprint matches disk.
 *
 * Prefer updating **`limsplus-prod.zip`** (mtime/size sync) unless you intentionally want one-off refresh.
 *
 * **`LIMSPLUS_LITE_IGNORE_BUNDLED_ZIP_CHANGED=1`** — never auto re-import when `limsplus-prod.zip`
 * bytes/mtime change (stay on embedded Mongo contents even if disk has a fresher ZIP).
 */
export function shouldForceLiteBundledDatabaseRestore(): boolean {
  const v =
    process.env.LIMSPLUS_LITE_FORCE_BUNDLED_RESTORE?.trim().toLowerCase() ??
    '';
  return v === '1' || v === 'true' || v === 'yes';
}

export function shouldIgnoreBundledZipFingerprintChanges(): boolean {
  const v =
    process.env.LIMSPLUS_LITE_IGNORE_BUNDLED_ZIP_CHANGED?.trim().toLowerCase() ??
    '';
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Default: **first run only** seeds from `database/dump`. Later launches use persisted
 * embedded Mongo (live Nest/backend writes). Opt-in to re-import when dump bytes change:
 * **`LIMSPLUS_LITE_REIMPORT_WHEN_DUMP_CHANGED=1`**.
 */
export function shouldReimportBundledDumpWhenArtifactChanges(): boolean {
  const v =
    process.env.LIMSPLUS_LITE_REIMPORT_WHEN_DUMP_CHANGED?.trim().toLowerCase() ??
    '';
  return v === '1' || v === 'true' || v === 'yes';
}

export type RestoreFromBundledDumpOptions = {
  /** First-time Lite setup: drop target DB and import bundled dump even if already seeded. */
  forceFreshImport?: boolean;
};

/** Drops the Lite database on embedded/local Mongo (used before first-time seed). */
export async function dropLiteMongoDatabase(
  mongoUri: string,
  dbName: string = DEFAULT_LITE_DB_NAME,
): Promise<void> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  try {
    await client.db(dbName).dropDatabase();
    if (!app.isPackaged) {
      console.info('[LimsPlus Lite] Dropped MongoDB database:', dbName);
    }
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function restoreFromBundledDumpIfNeeded(
  mongoUri: string,
  isAlreadyRestored: boolean,
  options?: RestoreFromBundledDumpOptions,
): Promise<RestoreDumpResult> {
  const forceBundledRestore =
    shouldForceLiteBundledDatabaseRestore() ||
    options?.forceFreshImport === true;
  const ignoreBundledFingerprint = shouldIgnoreBundledZipFingerprintChanges();

  const clientDbRoot = getLiteBundledDatabaseDirectory();

  /** Prefer live directory dumps (`database/dump`) over ZIP so edits take effect immediately. */
  const directoryDumpCandidates = dedupeOrderedPaths([
    path.join(clientDbRoot, 'dump'),
    path.join(process.resourcesPath, 'database', 'dump'),
    path.join(process.cwd(), 'database', 'dump'),
    path.join(app.getAppPath(), 'database', 'dump'),
    path.join(clientDbRoot, 'limsplus-prod'),
    path.join(process.resourcesPath, 'database', 'limsplus-prod'),
    path.join(process.cwd(), 'database', 'limsplus-prod'),
    path.join(app.getAppPath(), 'database', 'limsplus-prod'),
  ]);

  let folderPath: string | undefined;
  for (const dir of directoryDumpCandidates) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        folderPath = dir;
        break;
      }
    } catch {
      /* ignore */
    }
  }

  const zipCandidates = dedupeOrderedPaths([
    path.join(process.resourcesPath, 'database', 'limsplus-prod.zip'),
    path.join(clientDbRoot, 'limsplus-prod.zip'),
    path.join(process.cwd(), 'database', 'limsplus-prod.zip'),
    path.join(app.getAppPath(), 'database', 'limsplus-prod.zip'),
  ]);

  const zipPath = folderPath ? undefined : zipCandidates.find((p) => fs.existsSync(p));

  if (!zipPath && !folderPath) {
    if (isAlreadyRestored && !forceBundledRestore) {
      const priorOnly = readLiteBundledRestoreArtifactFingerprint();
      return {
        didRestore: false,
        databaseName:
          priorOnly?.lastDatabaseName ?? DEFAULT_LITE_DB_NAME,
      };
    }
    throw new Error(
      [
        `No MongoDB backup found.`,
        '',
        `Preferred: mongorestore --dir dump under`,
        `  ${path.join(clientDbRoot, 'dump')}`,
        `(nested *.bson / *.bson.gz files)`,
        '',
        `Or: database/limsplus-prod/ or database/limsplus-prod.zip`,
        '',
        'Checked directory roots:',
        ...directoryDumpCandidates.map((p) => `  • ${p}`),
        '',
        'Checked ZIP files:',
        ...zipCandidates.map((p) => `  • ${p}`),
      ].join('\n'),
    );
  }

  const liveFingerprint = zipPath
    ? fingerprintZip(zipPath)
    : fingerprintFolderDump(folderPath as string);

  const priorFingerprint = readLiteBundledRestoreArtifactFingerprint();

  let shouldImport = false;
  if (forceBundledRestore) {
    shouldImport = true;
  } else if (!isAlreadyRestored) {
    /** First Lite / Connect launch: seed embedded Mongo from bundled dump only. */
    shouldImport = true;
  } else if (
    shouldReimportBundledDumpWhenArtifactChanges() &&
    !ignoreBundledFingerprint &&
    priorFingerprint &&
    !bundledArtifactFingerprintsMatch(priorFingerprint, liveFingerprint)
  ) {
    shouldImport = true;
  } else {
    /** Already seeded — use live data in userData `lims-lite-mongodb`; do not overwrite from client/database/dump. */
    shouldImport = false;
  }

  if (!shouldImport) {
    if (!app.isPackaged) {
      if (isAlreadyRestored) {
        console.info(
          '[LimsPlus Lite] Using persisted local MongoDB — skipping bundled dump import (first-run seed already done). To re-seed from database/dump: LIMSPLUS_LITE_FORCE_BUNDLED_RESTORE=1 or clear limsOfflineDbRestored in user-preferences.json.',
        );
      } else if (priorFingerprint) {
        console.info(
          '[LimsPlus Lite] Skipping bundled DB import — dump/ZIP fingerprint unchanged vs marker.',
        );
      } else if (ignoreBundledFingerprint) {
        console.info(
          '[LimsPlus Lite] Skipping bundled DB import — LIMSPLUS_LITE_IGNORE_BUNDLED_ZIP_CHANGED is set.',
        );
      }
    }
    const databaseName =
      priorFingerprint?.lastDatabaseName ?? DEFAULT_LITE_DB_NAME;
    await ensureBundledMongoViews(mongoUri, databaseName, {
      folderPath,
      zipPath: zipPath ?? undefined,
    });
    return {
      didRestore: false,
      databaseName,
    };
  }

  if (options?.forceFreshImport) {
    console.info(
      '[LimsPlus Lite] First-time setup — dropping existing database and importing bundled backup.',
    );
  } else if (
    forceBundledRestore &&
    (!priorFingerprint ||
      bundledArtifactFingerprintsMatch(priorFingerprint, liveFingerprint))
  ) {
    console.warn(
      '[LimsPlus Lite] LIMSPLUS_LITE_FORCE_BUNDLED_RESTORE is set — re-importing bundled dump (drops target DB before insert).',
    );
  } else if (
    isAlreadyRestored &&
    priorFingerprint &&
    shouldImport &&
    !forceBundledRestore
  ) {
    console.warn(
      '[LimsPlus Lite] Bundled backup changed — re-importing Mongo snapshot (database/dump, limsplus-prod folder, or ZIP).',
    );
  }

  if (!app.isPackaged) {
    console.info('[LimsPlus Lite] Bundled Mongo restore diagnostics:', {
      resolveZipUsed: zipPath ?? null,
      resolveFolderUsed: folderPath ?? null,
      bundledArtifactFingerprint: liveFingerprint,
      priorArtifactMarkerPresent: Boolean(priorFingerprint),
      importing: shouldImport,
    });
  }

  const dumpFolder = resolveDatabaseDumpFolder({
    zipPath: zipPath ?? null,
    folderPath: folderPath ?? null,
  });
  const dbName = liteDbNameFromDumpPath(dumpFolder);

  await restoreLiteDatabaseDump(mongoUri, dumpFolder, dbName);

  const markerToPersist: LiteBundledRestoreArtifactFingerprint = {
    ...liveFingerprint,
    lastDatabaseName: dbName,
  };
  writeLiteBundledRestoreArtifactFingerprint(markerToPersist);

  return { didRestore: true, databaseName: dbName };
}

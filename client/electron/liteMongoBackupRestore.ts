import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { BSON, MongoClient } from 'mongodb';
import { mongoConnectionStringWithDatabase } from './liteNestBackend';
import {
  DEFAULT_LITE_DB_NAME,
  ensureLiteMongoRunning,
  findFirstBsonHierarchyRoot,
  getLiteBundledDatabaseDirectory,
  getLiteExternalMongoUriFromEnv,
  liteDbNameFromDumpPath,
  readLiteBundledRestoreArtifactFingerprint,
  restoreFromBundledDumpIfNeeded,
  restoreLiteDatabaseDump,
  shouldForceLiteBundledDatabaseRestore,
  waitUntilLiteMongoAcceptsConnections,
} from './offlineLimsLite';

const BACKUP_MANIFEST = 'limsplus-backup-manifest.json';

/** Same on-disk layout as `client/database/dump/limsplus-prod/*.bson`. */
export const LITE_MONGODUMP_DIR_SEGMENT = 'dump';

export type MongoBackupRestoreProgressEvent = {
  operation: 'backup' | 'restore';
  phase: 'step' | 'progress' | 'error' | 'done';
  step: number;
  totalSteps: number;
  label: string;
  percent: number;
  detail?: string;
};

export type LiteMongoMaintenanceReady = {
  mongoUri: string;
  databaseName: string;
  source: 'offline-json' | 'external-env' | 'embedded-lite';
  /** True when data was (re)loaded from `database/dump` or bundled ZIP like LimsPlus Lite. */
  didBundledRestore: boolean;
};

function emit(
  onProgress: ((e: MongoBackupRestoreProgressEvent) => void) | undefined,
  partial: Omit<MongoBackupRestoreProgressEvent, 'operation'> & {
    operation?: 'backup' | 'restore';
  },
  operation: 'backup' | 'restore',
): void {
  if (onProgress) {
    onProgress({ operation, ...partial } as MongoBackupRestoreProgressEvent);
  }
}

function databaseNameFromMongoUri(uri: string): string | null {
  try {
    const stripped = uri
      .split('?')[0]
      .replace(/^mongodb\+srv:/i, 'http:')
      .replace(/^mongodb:/i, 'http:');
    const u = new URL(stripped);
    const seg = u.pathname.replace(/^\//, '').split('/')[0];
    return seg?.length ? decodeURIComponent(seg) : null;
  } catch {
    return null;
  }
}

/**
 * Same Mongo path as **LimsPlus Lite**: embedded mongod + import from
 * `client/database/dump` (or ZIP) when the local DB is not ready yet.
 */
export async function ensureLiteMongoDatabaseForMaintenance(options: {
  isAlreadyRestored: boolean;
  operation: 'backup' | 'restore';
  onProgress?: (e: MongoBackupRestoreProgressEvent) => void;
}): Promise<LiteMongoMaintenanceReady> {
  const { isAlreadyRestored, operation, onProgress } = options;
  const totalSteps = 6;

  emit(
    onProgress,
    {
      phase: 'step',
      step: 1,
      totalSteps,
      label: 'Preparing local MongoDB (same as LimsPlus Lite)…',
      percent: 5,
    },
    operation,
  );

  const external = getLiteExternalMongoUriFromEnv();
  if (external) {
    const databaseName =
      databaseNameFromMongoUri(external) || DEFAULT_LITE_DB_NAME;
    const mongoUri = mongoConnectionStringWithDatabase(
      external,
      databaseName,
    );
    await waitUntilLiteMongoAcceptsConnections(mongoUri);
    return {
      mongoUri,
      databaseName,
      source: 'external-env',
      didBundledRestore: false,
    };
  }

  const embedded = await ensureLiteMongoRunning();
  let mongoUri = embedded.mongoUri;
  await waitUntilLiteMongoAcceptsConnections(mongoUri);

  let restoreOutcome: { didRestore: boolean; databaseName: string };
  if (isAlreadyRestored && !shouldForceLiteBundledDatabaseRestore()) {
    const marker = readLiteBundledRestoreArtifactFingerprint();
    restoreOutcome = {
      didRestore: false,
      databaseName: marker?.lastDatabaseName ?? DEFAULT_LITE_DB_NAME,
    };
    emit(
      onProgress,
      {
        phase: 'step',
        step: 2,
        totalSteps,
        label: 'Using live local MongoDB (first-run seed already done)…',
        percent: 12,
      },
      operation,
    );
  } else {
    emit(
      onProgress,
      {
        phase: 'step',
        step: 2,
        totalSteps,
        label: 'First-time seed from bundled dump if needed…',
        percent: 12,
        detail: path.join(
          getLiteBundledDatabaseDirectory(),
          LITE_MONGODUMP_DIR_SEGMENT,
        ),
      },
      operation,
    );
    restoreOutcome = await restoreFromBundledDumpIfNeeded(
      mongoUri,
      isAlreadyRestored,
    );
  }

  const databaseName =
    restoreOutcome.databaseName?.trim() || DEFAULT_LITE_DB_NAME;
  mongoUri = mongoConnectionStringWithDatabase(mongoUri, databaseName);
  await waitUntilLiteMongoAcceptsConnections(mongoUri);

  emit(
    onProgress,
    {
      phase: 'step',
      step: 3,
      totalSteps,
      label: restoreOutcome.didRestore
        ? 'Imported bundled dump into local MongoDB'
        : 'Using existing local MongoDB data',
      percent: 22,
      detail: `Database: ${databaseName}`,
    },
    operation,
  );

  const client = new MongoClient(mongoUri);
  await client.connect();
  try {
    const collCount = (
      await client.db(databaseName).listCollections().toArray()
    ).filter((c) => !c.name.startsWith('system.')).length;
    if (collCount === 0) {
      throw new Error(
        `Local database "${databaseName}" is empty. Run **LimsPlus Lite** once, or place a dump under:\n${path.join(getLiteBundledDatabaseDirectory(), LITE_MONGODUMP_DIR_SEGMENT, databaseName)}`,
      );
    }
  } finally {
    await client.close().catch(() => undefined);
  }

  return {
    mongoUri,
    databaseName,
    source: 'embedded-lite',
    didBundledRestore: restoreOutcome.didRestore,
  };
}

function bsonFileBufferFromDocuments(docs: Record<string, unknown>[]): Buffer {
  const chunks: Buffer[] = [];
  for (const doc of docs) {
    chunks.push(Buffer.from(BSON.serialize(doc)));
  }
  return Buffer.concat(chunks);
}

function isUserCollectionName(name: string): boolean {
  return !name.startsWith('system.');
}

function writeCollectionMetadataFile(
  dbFolder: string,
  collName: string,
  docCount: number,
): void {
  const metaPath = path.join(dbFolder, `${collName}.metadata.json`);
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        indexes: [
          {
            v: 2,
            key: { _id: 1 },
            name: '_id_',
          },
        ],
        collectionName: collName,
        type: 'collection',
        exportedBy: 'LimsPlus Connect',
        documentCount: docCount,
      },
      null,
      2,
    ),
  );
}

export async function exportLiteMongoDatabaseToFolder(options: {
  mongoUri: string;
  databaseName: string;
  destinationRoot: string;
  onProgress: (e: MongoBackupRestoreProgressEvent) => void;
}): Promise<{
  outputDir: string;
  dumpRoot: string;
  collectionsExported: number;
  documentsExported: number;
}> {
  const { mongoUri, databaseName, destinationRoot, onProgress } = options;
  const op = 'backup' as const;
  const totalSteps = 5;

  emit(
    onProgress,
    {
      phase: 'step',
      step: 4,
      totalSteps,
      label: 'Connecting to local Lite MongoDB…',
      percent: 28,
      detail: databaseName,
    },
    op,
  );
  await waitUntilLiteMongoAcceptsConnections(mongoUri);

  /** Matches `client/database/dump/limsplus-prod/` (mongodump directory layout). */
  const outputDir = path.join(path.resolve(destinationRoot), LITE_MONGODUMP_DIR_SEGMENT);
  const dbFolder = path.join(outputDir, databaseName);
  fs.mkdirSync(dbFolder, { recursive: true });

  emit(
    onProgress,
    {
      phase: 'step',
      step: 4,
      totalSteps,
      label: 'Listing collections…',
      percent: 35,
      detail: dbFolder,
    },
    op,
  );

  const client = new MongoClient(mongoUri);
  await client.connect();
  let collectionsExported = 0;
  let documentsExported = 0;

  try {
    const db = client.db(databaseName);
    const names = (await db.listCollections().toArray())
      .map((c) => c.name)
      .filter(isUserCollectionName)
      .sort((a, b) => a.localeCompare(b));

    if (names.length === 0) {
      throw new Error(
        `Database "${databaseName}" has no collections. Open **LimsPlus Lite** first to load ${LITE_MONGODUMP_DIR_SEGMENT}/${databaseName}.`,
      );
    }

    emit(
      onProgress,
      {
        phase: 'step',
        step: 4,
        totalSteps,
        label: `Exporting ${names.length} collection(s)…`,
        percent: 40,
      },
      op,
    );

    for (let i = 0; i < names.length; i++) {
      const collName = names[i];
      const coll = db.collection(collName);
      const docs = (await coll.find({}).toArray()) as Record<string, unknown>[];

      const pct = 40 + Math.round(((i + 0.5) / names.length) * 50);
      emit(
        onProgress,
        {
          phase: 'progress',
          step: 4,
          totalSteps,
          label: `Writing ${collName}.bson`,
          percent: pct,
          detail: `${i + 1} of ${names.length} · ${docs.length} document(s)`,
        },
        op,
      );

      fs.writeFileSync(
        path.join(dbFolder, `${collName}.bson`),
        bsonFileBufferFromDocuments(docs),
      );
      writeCollectionMetadataFile(dbFolder, collName, docs.length);
      collectionsExported += 1;
      documentsExported += docs.length;
    }

    const manifest = {
      app: 'LimsPlus Connect',
      format: 'mongodump-directory-bson',
      layout: `${LITE_MONGODUMP_DIR_SEGMENT}/<database>/*.bson`,
      databaseName,
      createdAt: new Date().toISOString(),
      collectionsExported,
      documentsExported,
      compatibleWith: 'LimsPlus Lite restore and client/database/dump',
    };
    fs.writeFileSync(
      path.join(outputDir, BACKUP_MANIFEST),
      JSON.stringify(manifest, null, 2),
    );

    emit(
      onProgress,
      {
        phase: 'done',
        step: 5,
        totalSteps,
        label: 'Backup complete',
        percent: 100,
        detail: `${collectionsExported} collections · ${documentsExported} documents → ${dbFolder}`,
      },
      op,
    );

    return {
      outputDir,
      dumpRoot: dbFolder,
      collectionsExported,
      documentsExported,
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function restoreLiteMongoDatabaseFromFolder(options: {
  mongoUri: string;
  databaseName: string;
  sourceFolder: string;
  onProgress: (e: MongoBackupRestoreProgressEvent) => void;
}): Promise<{
  documentsInserted: number;
  collectionsRestored: number;
  databaseName: string;
}> {
  const { mongoUri, sourceFolder, onProgress } = options;
  const op = 'restore' as const;
  const totalSteps = 5;

  emit(
    onProgress,
    {
      phase: 'step',
      step: 4,
      totalSteps,
      label: 'Scanning backup folder…',
      percent: 30,
      detail: sourceFolder,
    },
    op,
  );

  const abs = path.resolve(sourceFolder);
  let bsonRoot = findFirstBsonHierarchyRoot(abs);
  if (!bsonRoot) {
    const dumpChild = path.join(abs, LITE_MONGODUMP_DIR_SEGMENT);
    if (fs.existsSync(dumpChild)) {
      bsonRoot = findFirstBsonHierarchyRoot(dumpChild);
    }
  }
  if (!bsonRoot) {
    throw new Error(
      `No BSON backup found. Select a folder with ${LITE_MONGODUMP_DIR_SEGMENT}/limsplus-prod/*.bson (same layout as client/database/dump), or a folder that already contains *.bson files.`,
    );
  }

  const dbName =
    options.databaseName?.trim() ||
    liteDbNameFromDumpPath(bsonRoot) ||
    DEFAULT_LITE_DB_NAME;

  emit(
    onProgress,
    {
      phase: 'step',
      step: 4,
      totalSteps,
      label: `Importing into local Lite MongoDB "${dbName}"…`,
      percent: 35,
      detail: `BSON root: ${bsonRoot}`,
    },
    op,
  );

  const result = await restoreLiteDatabaseDump(
    mongoUri,
    bsonRoot,
    dbName,
    (p) => {
      const pct =
        35 +
        Math.round((p.collectionIndex / Math.max(p.collectionTotal, 1)) * 60);
      emit(
        onProgress,
        {
          phase: 'progress',
          step: 4,
          totalSteps,
          label: `Restoring ${p.collectionName}`,
          percent: pct,
          detail: `${p.collectionIndex}/${p.collectionTotal} files · ${p.documentsInCollection} docs`,
        },
        op,
      );
    },
  );

  emit(
    onProgress,
    {
      phase: 'done',
      step: 5,
      totalSteps,
      label: 'Restore complete',
      percent: 100,
      detail: `${result.collectionsRestored} collections · ${result.documentsInserted} documents imported into local Lite MongoDB`,
    },
    op,
  );

  return {
    ...result,
    databaseName: dbName,
  };
}

import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { resolveExclusiveLoopbackTcpPort } from './exclusiveLoopbackTcpPort';

/** Nest / GraphQL API for LimsPlus Lite — loopback only. */
export const LIMS_LITE_API_HOST = '127.0.0.1';

/**
 * Default Nest HTTP port (**8080**) when {@link process.env.LIMS_LITE_API_PORT} is unset.
 * Conflicts: other listeners on that port are stopped unless **`LIMSPLUS_LITE_DO_NOT_KILL_OCCUPIED_API_PORT=1`**.
 * **`LIMS_LITE_API_PORT=auto`** or **`0`** → OS ephemeral port.
 */
export const LIMS_LITE_API_DEFAULT_PREFERRED_PORT = 8080;

let nestLiteChild: ChildProcess | null = null;

export function getLiteBackendRoot(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'lite-backend');
  }
  return path.resolve(__dirname, '../../app/backend');
}

export function getLiteBackendEntryPath(): string {
  const root = getLiteBackendRoot();
  const nested = path.join(root, 'dist', 'main.js');
  if (fs.existsSync(nested)) {
    return nested;
  }
  /** e.g. copy `service/dist/*` into app/backend so `main.js` lives at backend root */
  return path.join(root, 'main.js');
}

export function stopLiteNestBackend(): void {
  if (!nestLiteChild || nestLiteChild.killed) {
    nestLiteChild = null;
    return;
  }
  try {
    nestLiteChild.kill();
  } catch {
    /* ignore */
  }
  nestLiteChild = null;
}

function waitForHttpAnyResponse(
  port: number,
  host: string,
  timeoutMs: number,
): Promise<void> {
  const raw = process.env.LIMS_LITE_BACKEND_HEALTH_PATH ?? '/';
  const pathPart = raw.startsWith('/') ? raw : `/${raw}`;
  const url = `http://${host}:${port}${pathPart}`;
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = (): void => {
      if (Date.now() > deadline) {
        reject(
          new Error(
            `Lite Nest API did not become ready within ${timeoutMs}ms (${url}). Check backend logs and LIMS_LITE_BACKEND_HEALTH_PATH.`,
          ),
        );
        return;
      }
      const req = http.get(url, { timeout: 2000 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        setTimeout(attempt, 500);
      });
      req.on('timeout', () => {
        req.destroy();
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

/**
 * `mongodb://127.0.0.1:27017//limsplus-prod` (double slash) makes some drivers /
 * Mongoose treat the DB name oddly; normalize to exactly one slash before the DB segment.
 */
function sanitizeMongoDupSlashesAfterAuthority(uri: string): string {
  const t = uri.trim();
  if (!/^mongodb(?:\+srv)?:\/\//i.test(t)) return uri;
  return t.replace(
    /(mongodb(?:\+srv)?:\/\/[^/?#]+)(\/{2,})(?=\?|$|[^\s?#])/gi,
    '$1/',
  );
}

/**
 * limsplus-service resolves Mongo via `getMongodbUrl(process.env.ENV)` → e.g.
 * `MONGODB_URL_LOCAL` when `ENV` is `Local`. Also ensure the default DB name is in the URI for Mongoose.
 */
export function mongoConnectionStringWithDatabase(
  mongoUri: string,
  databaseName: string,
): string {
  const uri = sanitizeMongoDupSlashesAfterAuthority(mongoUri.trim());
  const db = (databaseName || 'limsplus-prod').trim();
  if (!uri || !db) return uri;

  const m =
    /^((mongodb(?:\+srv)?):\/\/[^/?]+)(\/[^?]*)?(\?.*)?$/i.exec(uri);
  if (!m) {
    return sanitizeMongoDupSlashesAfterAuthority(
      uri.replace(/\/+$/, '') + `/${encodeURIComponent(db)}`,
    );
  }
  const base = m[1];
  const existingPath = m[3] ?? '';
  const query = m[4] ?? '';
  const pathAfterSlash = existingPath.length > 1 ? existingPath.slice(1) : '';
  const pathHasDb =
    pathAfterSlash.length > 0 && !pathAfterSlash.includes('/');
  if (pathHasDb) {
    return sanitizeMongoDupSlashesAfterAuthority(uri);
  }
  return sanitizeMongoDupSlashesAfterAuthority(
    `${base}/${encodeURIComponent(db)}${query}`,
  );
}

/**
 * Runs `dist/main.js` with ELECTRON_RUN_AS_NODE (packaged) so a separate Node
 * install is not required. Dev: same, or set LIMS_LITE_USE_SYSTEM_NODE=1 to use `node` from PATH.
 */
export async function startLiteNestBackend(options: {
  mongoUri: string;
  databaseName: string;
}): Promise<{ apiBaseUrl: string; port: number }> {
  stopLiteNestBackend();

  const backendRoot = getLiteBackendRoot();
  const entry = getLiteBackendEntryPath();

  if (!fs.existsSync(entry)) {
    throw new Error(
      `Nest Lite API not built. Missing:\n${entry}\n\nFrom repo: cd client/app/backend && npm install && npm run build`,
    );
  }

  const mongoForNest = mongoConnectionStringWithDatabase(
    options.mongoUri,
    options.databaseName,
  );

  const skipKillApiPort =
    process.env.LIMSPLUS_LITE_DO_NOT_KILL_OCCUPIED_API_PORT === '1' ||
    process.env.LIMSPLUS_LITE_DO_NOT_KILL_OCCUPIED_API_PORT === 'true';

  const port = await resolveExclusiveLoopbackTcpPort({
    rawPortEnv: process.env.LIMS_LITE_API_PORT,
    defaultPort: LIMS_LITE_API_DEFAULT_PREFERRED_PORT,
    skipKillOccupiers: skipKillApiPort,
    roleLabel: 'Nest API',
    portEnvVarName: 'LIMS_LITE_API_PORT',
    skipKillEnvVarName: 'LIMSPLUS_LITE_DO_NOT_KILL_OCCUPIED_API_PORT',
  });
  const useSystemNode =
    process.env.LIMS_LITE_USE_SYSTEM_NODE === '1' ||
    process.env.LIMS_LITE_USE_SYSTEM_NODE === 'true';

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? 'production',
    /** Service `core-utils/database.util` maps `ENV` → `MONGODB_URL_*` — not raw MONGODB_URI. */
    ENV: 'Local',
    PORT: String(port),
    HOST: LIMS_LITE_API_HOST,
    /**
     * Highest-priority URIs so Lite wins over stale `backend/.env` (`MONGODB_URL_LOCAL`, etc.).
     * `core-utils/database.util` checks `LIMSPLUS_LITE_EMBEDDED_MONGO_URI` first.
     */
    LIMSPLUS_LITE_EMBEDDED_MONGO_URI: mongoForNest,
    MONGODB_URL_LOCAL: mongoForNest,
    MONGODB_URL_DEV: mongoForNest,
    MONGODB_URL_PROD: mongoForNest,
    MONGODB_URL_DOCKER: mongoForNest,
    MONGODB_URI: mongoForNest,
    /** `config/config` reads bare `MONGODB_URL`; keep aligned with embedded mongod URI. */
    MONGODB_URL: mongoForNest,
    DATABASE_URL: mongoForNest,
    MONGO_DATABASE: options.databaseName,
    LIMS_LITE_MONGO_DATABASE: options.databaseName,
  };

  if (!useSystemNode) {
    childEnv.ELECTRON_RUN_AS_NODE = '1';
  }

  const command = useSystemNode ? 'node' : process.execPath;

  const child = spawn(command, [entry], {
    cwd: backendRoot,
    env: childEnv,
    /** In packaged mode inherit can flood; pipe and forward below. */
    stdio:
      app.isPackaged || process.env.LIMS_LITE_BACKEND_SILENT_IO === '1'
        ? ['ignore', 'pipe', 'pipe']
        : 'inherit',
    windowsHide: true,
  });

  nestLiteChild = child;

  child.on('exit', (code, signal) => {
    if (nestLiteChild === child) {
      nestLiteChild = null;
    }
    console.warn('[LimsPlus Lite API] exited', {
      code,
      signal,
    });
  });

  if (child.stdout) {
    child.stdout.on('data', (chunk: Buffer) =>
      console.info('[LimsPlus Lite API]', chunk.toString().trimEnd()),
    );
  }
  if (child.stderr) {
    child.stderr.on('data', (chunk: Buffer) =>
      console.error('[LimsPlus Lite API]', chunk.toString().trimEnd()),
    );
  }

  const timeoutMs = Number.parseInt(
    process.env.LIMS_LITE_BACKEND_START_TIMEOUT_MS ?? '180000',
    10,
  );
  const waitMs =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 180000;

  const httpReady = waitForHttpAnyResponse(
    port,
    LIMS_LITE_API_HOST,
    waitMs,
  );

  const failure = new Promise<never>((_, reject) => {
    child.once('error', (err) => {
      reject(
        err instanceof Error
          ? err
          : new Error(`Nest Lite API spawn error: ${String(err)}`),
      );
    });
    child.once('exit', (code, signal) => {
      reject(
        new Error(
          `Nest Lite API exited during startup (code ${code}${
            signal ? ` signal ${signal}` : ''
          }). Check logs tagged [LimsPlus Lite API].`,
        ),
      );
    });
  });

  await Promise.race([httpReady, failure]);

  return {
    apiBaseUrl: `http://${LIMS_LITE_API_HOST}:${port}`,
    port,
  };
}

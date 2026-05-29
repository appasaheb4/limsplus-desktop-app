import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Menu,
  WebContents,
  session,
  dialog,
} from 'electron';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import {
  ensureLiteMongoRunning,
  waitUntilLiteMongoAcceptsConnections,
  stopLiteMongoServer,
  restoreFromBundledDumpIfNeeded,
  isLiteMongoServerActive,
  getLiteMongoPlatformSummary,
  getLiteExternalMongoUriFromEnv,
  redactMongoUriForLogs,
  mongoTcpListenPortHint,
  LIMS_LITE_MONGO_LOOPBACK_BIND,
  LIMS_LITE_MONGO_DEFAULT_PREFERRED_PORT,
} from './offlineLimsLite';
import {
  getLiteBackendEntryPath,
  startLiteNestBackend,
  stopLiteNestBackend,
} from './liteNestBackend';
import {
  exportLiteMongoDatabaseToFolder,
  restoreLiteMongoDatabaseFromFolder,
  ensureLiteMongoDatabaseForMaintenance,
  MongoBackupRestoreProgressEvent,
} from './liteMongoBackupRestore';
import { verifyActivationKeyViaApi } from './licenseActivation';
import {
  isLicenseSecurelyActivated,
  migrateLegacyPlaintextFlag,
  persistSecureActivationRecord,
} from './licenseSecureStorage';
import installExtension, {
  REACT_DEVELOPER_TOOLS,
} from 'electron-devtools-installer';

const Store = require('./store.js');
const MessageStore = require('./messageStore.js');
const InstrumentLogsStore = require('./instrumentLogsStore');
const WebSocket = require('ws');
const { spawn } = require('child_process');
let serverProcess: any = null;

// for file upload
const fs = require('fs');
const FormData = require('form-data');
const { default: axios } = require('axios');

/** Same core as `serve -s <dir>` (SPA fallback + static files); avoids `file://` breaking `/static/...`. */
const serveHandler = require('serve-handler') as (
  request: http.IncomingMessage,
  response: http.ServerResponse,
  config?: Record<string, unknown>,
) => Promise<void>;

let mainWindow: any;
// let childWindows = [];
let childWindows: any;
/** Standalone window for the bundled portal (production build under app/frontend). */
let limsPlusLiteWindow: BrowserWindow | null = null;
/** Loopback HTTP server (`serve-handler`, like `serve -s app/frontend`). */
let limsPortalStaticServer: http.Server | null = null;
/** Isolated Lite session — avoids stale CRA service worker cache from the shell. */
const LIMSPLUS_LITE_SESSION_PARTITION = 'persist:limsplus-lite-portal';

function stopLimsPortalStaticServer(): void {
  if (limsPortalStaticServer) {
    limsPortalStaticServer.close(() => {});
    limsPortalStaticServer = null;
  }
}

/** Passes spawned Nest loopback URL into CRA via query; bootstrap captures it → sessionStorage. */
function appendPortalLiteApiBaseQuery(
  portalUrl: string,
  liteApiBaseUrl: string,
): string {
  const trimmed = liteApiBaseUrl.replace(/\/$/, '');
  const u = new URL(portalUrl);
  u.searchParams.delete('limsplusLiteApiBase');
  u.searchParams.delete('liteApiBase');
  u.searchParams.set('limsplusLiteApiBase', trimmed);
  return u.toString();
}

const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

/** Path portion of `GET /graphql?x=1`-style URLs (no fragment). */
function httpPathOnly(rawUrl: string | undefined): string {
  const u = rawUrl || '/';
  const q = u.indexOf('?');
  const pathPart = q === -1 ? u : u.slice(0, q);
  return pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
}

function stripTrailingSlashExceptRoot(pathname: string): string {
  if (pathname !== '/' && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/** Pathname on the lite static origin that should proxy to Nest (e.g. `/graphql`). */
function liteGraphqlPathFromUpstream(upstreamAbsolute: string): string {
  try {
    let p = httpPathOnly(new URL(upstreamAbsolute).pathname);
    return stripTrailingSlashExceptRoot(p) || '/graphql';
  } catch {
    return '/graphql';
  }
}

function requestTargetsLiteGraphql(
  rawReqUrl: string | undefined,
  liteGraphqlPath: string,
): boolean {
  return (
    stripTrailingSlashExceptRoot(httpPathOnly(rawReqUrl)) ===
    stripTrailingSlashExceptRoot(liteGraphqlPath)
  );
}

function forwardHeadersToUpstream(
  from: http.IncomingHttpHeaders,
  hostHeader: string,
): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = {};
  for (const [key, val] of Object.entries(from)) {
    if (val === undefined) continue;
    const lk = key.toLowerCase();
    if (HOP_BY_HOP_REQUEST_HEADERS.has(lk)) continue;
    if (lk === 'host') continue;
    out[key] = val;
  }
  out.host = hostHeader;
  return out;
}

function sanitizeProxyResponseHeaders(
  from: http.IncomingHttpHeaders,
): http.OutgoingHttpHeaders {
  const out = { ...from } as http.OutgoingHttpHeaders;
  delete out.connection;
  delete out['transfer-encoding'];
  delete out['keep-alive'];
  return out;
}

/**
 * Forwards `/graphql` (multipart or JSON) from the CRA static origin to Nest on
 * `{liteApiBaseUrl}/graphql`, avoiding `serve-handler` SPA rewrites returning HTML for JSON parsers.
 */
function proxyNestGraphql(
  nestGraphqlAbsolute: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  let targetUrl: URL;
  try {
    targetUrl = new URL(nestGraphqlAbsolute);
  } catch (e: unknown) {
    console.error('[LimsPlus Lite] Invalid Nest GraphQL URL', e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Invalid GraphQL upstream URL');
    }
    return;
  }

  const isHttps = targetUrl.protocol === 'https:';
  const proto = isHttps ? https : http;
  const portNum =
    targetUrl.port !== ''
      ? Number.parseInt(targetUrl.port, 10)
      : isHttps
        ? 443
        : 80;

  const rawReq = req.url || '/';
  const qStart = rawReq.indexOf('?');
  const query = qStart === -1 ? '' : rawReq.slice(qStart);
  let upstreamPath = stripTrailingSlashExceptRoot(httpPathOnly(targetUrl.pathname));
  if (upstreamPath === '') {
    upstreamPath = '/graphql';
  }
  upstreamPath += query;

  const upstreamHostHeader =
    targetUrl.host ||
    `${targetUrl.hostname}:${targetUrl.port || (isHttps ? '443' : '80')}`;

  const opts: https.RequestOptions = {
    hostname: targetUrl.hostname,
    port: portNum,
    path: upstreamPath,
    method: req.method || 'GET',
    headers: forwardHeadersToUpstream(req.headers, upstreamHostHeader),
    timeout: 120_000,
  };

  const preq = proto.request(opts, (pres: http.IncomingMessage) => {
    if (!pres.statusCode) {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.end('Bad gateway (no upstream status)');
      }
      return;
    }
    try {
      res.writeHead(pres.statusCode, sanitizeProxyResponseHeaders(pres.headers));
    } catch {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.end('Bad gateway');
      }
      return;
    }
    pres.on('error', (e: unknown) => {
      console.error('[LimsPlus Lite GraphQL proxy] upstream response stream', e);
      if (!res.headersSent) {
        res.destroy();
      } else {
        res.socket?.destroy?.();
      }
    });
    pres.pipe(res);
  });

  req.on('aborted', () => {
    preq.destroy();
  });

  req.on('error', (e: unknown) => {
    console.error('[LimsPlus Lite GraphQL proxy] client request error', e);
    preq.destroy();
  });

  preq.on('error', (e: unknown) => {
    console.error('[LimsPlus Lite GraphQL proxy]', e);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end('Lite GraphQL proxy: upstream unreachable');
    } else {
      res.socket?.destroy?.();
    }
  });

  preq.flushHeaders?.();
  req.pipe(preq);
}

function startLimsPortalStaticServer(
  buildRootAbs: string,
  nestGraphqlAbsolute?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    stopLimsPortalStaticServer();
    const buildRootNorm = path.resolve(buildRootAbs);

    const liteGraphqlPath = nestGraphqlAbsolute
      ? liteGraphqlPathFromUpstream(nestGraphqlAbsolute)
      : '';

    const server = http.createServer((req, res) => {
      if (!app.isPackaged) {
        res.once('finish', () => {
          console.info(
            '[LimsPlus Lite HTTP]',
            req.method,
            res.statusCode,
            req.url,
          );
        });
      }

      if (
        nestGraphqlAbsolute &&
        requestTargetsLiteGraphql(req.url, liteGraphqlPath)
      ) {
        proxyNestGraphql(nestGraphqlAbsolute, req, res);
        return;
      }

      void serveHandler(req, res, {
        public: buildRootNorm,
        directoryListing: false,
        cleanUrls: false,
        /** Same idea as `serve -s`: client routes fall back to `index.html`. */
        rewrites: [{ source: '**', destination: '/index.html' }],
      }).catch((err: unknown) => {
        console.error('[LimsPlus Lite] serve-handler', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      });
    });

    limsPortalStaticServer = server;
    server.on('error', (err: Error & { code?: string }) => {
      limsPortalStaticServer = null;
      reject(err);
    });

    server.listen({ host: '127.0.0.1', port: 0 }, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        stopLimsPortalStaticServer();
        reject(new Error('Lite portal server: invalid listen address'));
        return;
      }
      resolve(`http://127.0.0.1:${addr.port}`);
    });
  });
}

let ws: WebSocket | null = null; // Define ws in a global scope

/** Guards async Mongo shutdown loop on duplicate before-quit. */
let isLiteMongoQuitHandling = false;

const isDev = !app.isPackaged;
process.env.NODE_ENV = 'production';

/** Connector React dev server (CRA), default port 3000. Override with `LIMSPLUS_CONNECT_DEV_URL`. */
function getConnectorDevUrl(): string {
  const raw = process.env.LIMSPLUS_CONNECT_DEV_URL?.trim();
  if (raw) return raw.replace(/\/$/, '');
  return 'http://127.0.0.1:3000';
}

const store = new Store({
  configName: 'user-preferences',
  defaults: {
    accessToken: '',
    user: {},
    companyList: [],
    /** One-time BSON restore into embedded Mongo for offline LimsPlus Lite. */
    limsOfflineDbRestored: false,
  },
});

const messageStore = new MessageStore({
  configName: 'received-message',
  defaults: {
    receivedMessage: '',
  },
});

const instrumentLogStore = new InstrumentLogsStore({
  configName: 'instrument-logs',
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: isDev ? 1424 : 1024,
    height: 768,
    title: 'LimsPlus Connect',
    resizable: false,
    icon: path.join(__dirname, '../assets/icon.ico'),
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.autoHideMenuBar = true;
  const user = store.get('user');
  if (user?.userId) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('user', user);
    });
  }

  if (isDev) {
    if (shouldAutoOpenElectronDevTools()) {
      mainWindow.webContents.openDevTools();
    }
    const connectorUrl = getConnectorDevUrl();
    console.info('[LimsPlus Connect] loading connector UI:', connectorUrl);
    mainWindow.loadURL(connectorUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/** CRA/web bundle copied to client/app/frontend (dev) or Resources/portal-build (packaged). */
function getPortalBuildIndexPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'portal-build', 'index.html');
  }
  /** Compiled main lives in `build/electron/` — deterministic vs `app.getAppPath()`. */
  return path.resolve(__dirname, '../../app/frontend/index.html');
}

function warnIfPortalUsesExternalAssets(indexHtmlPath: string): void {
  if (app.isPackaged) return;
  try {
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    const tagRe =
      /<(?:script|link)[^>]*\s(?:src|href)=["']([^"']+)["']/gi;
    const remote: string[] = [];
    let m: RegExpExecArray | null;
    for (;;) {
      m = tagRe.exec(html);
      if (!m) break;
      const u = m[1].trim();
      if (/^https?:\/\//i.test(u)) remote.push(u);
    }
    if (remote.length) {
      console.warn(
        '[LimsPlus Lite] index.html references remote scripts/styles — offline Lite needs a rebuild with relative PUBLIC_URL/homepage:',
        remote.slice(0, 12),
      );
    }
  } catch {
    /* ignore */
  }
}

/**
 * Chromium DevTools log harmless `Autofill.*` CDP failures to stderr — noisy in the terminal.
 * Auto-open DevTools only when opted in (`LIMSPLUS_OPEN_DEVTOOLS`). You can still open DevTools manually (e.g. View menu / ⌥⌘I).
 */
function shouldAutoOpenElectronDevTools(): boolean {
  const v = (process.env.LIMSPLUS_OPEN_DEVTOOLS ?? '').toLowerCase();
  if (v === '0' || v === 'false') return false;
  return v === '1' || v === 'true';
}

/** React DevTools extension is separate from opening the DevTools panel — opt-in via `LIMSPLUS_REACT_DEVTOOLS`. */
function shouldInstallReactDeveloperTools(): boolean {
  const v = (process.env.LIMSPLUS_REACT_DEVTOOLS ?? '').toLowerCase();
  return v === '1' || v === 'true';
}

app.whenReady().then(() => {
  if (shouldInstallReactDeveloperTools()) {
    installExtension(REACT_DEVELOPER_TOOLS)
      .then((name) => console.log(`Added Extension:  ${name}`))
      .catch((err) => console.log('An error occurred: ', err));
  }
  Menu.setApplicationMenu(null);
  createWindow();
  // app.on('activate', () => {
  //   if (BrowserWindow.getAllWindows().length === 0) {
  //     createWindow();
  //   }
  // });
  app.on('window-all-closed', () => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
});

ipcMain.on('navigate-to-integration-gateway', (event, route) => {
  childWindows = new BrowserWindow({
    parent: mainWindow,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  if (isDev) {
    if (shouldAutoOpenElectronDevTools()) {
      childWindows.webContents.openDevTools();
    }
    childWindows.loadURL(`${getConnectorDevUrl()}#${route}`);
  } else {
    childWindows.loadFile(path.join(__dirname, '../index.html'), {
      hash: route,
    });
  }
  childWindows.once('ready-to-show', () => {
    childWindows.maximize();
    childWindows.show();
  });

  // Start the Python server
  if (isDev) {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const serverScript = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'server',
      'main.py',
    );
    serverProcess = spawn(pythonCmd, [serverScript], { stdio: 'inherit' });
  } else {
    const serverPath = path.join(
      process.resourcesPath,
      'server',
      process.platform === 'win32' ? 'server.exe' : 'server',
    );
    serverProcess = spawn(serverPath, [], { stdio: 'inherit' });
  }

  serverProcess.on('error', (err: string) => {
    console.error('Failed to start Python server:', err);
  });

  serverProcess.on('exit', (code: string) => {
    console.log(`Python server exited with code ${code}`);
  });

  childWindows.on('closed', () => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
      console.log(
        'Python server stopped because the integration-gateway screen was closed.',
      );
    }
    childWindows = null;
  });
});

ipcMain.on('navigate-to-iframe-screen', (event, url, title) => {
  childWindows = new BrowserWindow({
    parent: mainWindow,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  childWindows.maximize();
  childWindows.loadURL(url);
  childWindows.setTitle(title);
  childWindows.webContents.send('set-title', title); // Send title to renderer process
});

type PrepareLimsLiteResult =
  | {
      ok: true;
      mongoUri: string;
      databaseName: string;
      firstRunRestore: boolean;
    }
  | { ok: false; error: string; portalIndexPath?: string; backendEntryPath?: string };

/** Progress for the LimsPlus Lite setup modal in the renderer. */
type LimsLiteSetupProgressEvent =
  | { phase: 'step'; step: number; hint?: string }
  | { phase: 'error'; message: string };

const LIMS_LITE_STEP_COUNT = 6;

function emitLiteSetupProgress(
  wc: WebContents,
  evt: LimsLiteSetupProgressEvent,
) {
  try {
    if (!wc.isDestroyed()) {
      wc.send('lims-lite-setup-progress', evt);
    }
  } catch {
    /* ignore IPC after reload */
  }
}

function emitLitePhase(wc: WebContents, step: number, hint?: string) {
  emitLiteSetupProgress(wc, {
    phase: 'step',
    step: Math.min(Math.max(step, 1), LIMS_LITE_STEP_COUNT),
    ...(hint !== undefined ? { hint } : {}),
  });
}

async function ensureLocalLimsPlusLiteWindowOpen(
  portalServeUrl: string,
): Promise<void> {
  if (limsPlusLiteWindow && !limsPlusLiteWindow.isDestroyed()) {
    limsPlusLiteWindow.focus();
    limsPlusLiteWindow.show();
    return;
  }

  await session
    .fromPartition(LIMSPLUS_LITE_SESSION_PARTITION)
    .clearStorageData({ storages: ['serviceworkers'] })
    .catch((e: unknown) =>
      console.warn('[LimsPlus Lite] could not clear service workers:', e),
    );

  /**
   * Lite SPA (`http://127.0.0.1:<dynamic-spa-port>`) vs Nest (`http://127.0.0.1:<api-port>`) are different origins
   * unless you merge them behind one listener — **`limsplusLiteApiBase`** avoids wrong fixed ports when CRA and Nest diverge (**`8080`**, ephemeral, …).
   * CORS preflights hit unless Nest allows the portal origin or this window skips **`webSecurity`** (default for offline Lite).
   * Set **`LIMSPLUS_LITE_STRICT_WEB_SECURITY=1`** to keep **`webSecurity`** on (configure Nest **`enableCors`**).
   */
  const liteStrictWebSecurity =
    process.env.LIMSPLUS_LITE_STRICT_WEB_SECURITY === '1' ||
    process.env.LIMSPLUS_LITE_STRICT_WEB_SECURITY === 'true';

  limsPlusLiteWindow = new BrowserWindow({
    show: false,
    title: 'LimsPlus Lite',
    backgroundColor: '#1a1a1a',
    autoHideMenuBar: true,
    webPreferences: {
      partition: LIMSPLUS_LITE_SESSION_PARTITION,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: liteStrictWebSecurity,
    },
  });
  limsPlusLiteWindow.setMenuBarVisibility(false);

  const wc = limsPlusLiteWindow.webContents;

  wc.on(
    'did-fail-load',
    (_evt, code, description, validatedURL, isMainFrame) => {
      console.error('[LimsPlus Lite] did-fail-load', {
        code,
        description,
        validatedURL,
        isMainFrame,
      });
      if (isMainFrame) {
        if (shouldAutoOpenElectronDevTools()) {
          wc.openDevTools({ mode: 'detach' });
        }
        limsPlusLiteWindow?.show();
        limsPlusLiteWindow?.focus();
      }
    },
  );

  wc.on('console-message', (_e, level, message, line, sourceId) => {
    const meta = { line, sourceId, level };
    if (level >= 2) {
      console.error('[LimsPlus Lite renderer]', message, meta);
    } else if (isDev && level >= 1) {
      console.warn('[LimsPlus Lite renderer]', message, meta);
    }
  });

  wc.on('render-process-gone', (_e, details) => {
    console.error('[LimsPlus Lite] render-process-gone', details);
  });

  let liteShownOnce = false;
  const revealLiteWindow = () => {
    const win = limsPlusLiteWindow;
    if (!win || win.isDestroyed() || liteShownOnce) return;
    liteShownOnce = true;
    win.maximize();
    win.show();
  };

  limsPlusLiteWindow.once('ready-to-show', revealLiteWindow);
  wc.once('did-finish-load', () => {
    revealLiteWindow();
    if (
      isDev &&
      shouldAutoOpenElectronDevTools() &&
      process.env.LIMSPLUS_LITE_NO_DEVTOOLS !== '1'
    ) {
      const raw = Number.parseInt(
        process.env.LIMSPLUS_LITE_DEVTOOLS_DELAY_MS ?? '900',
        10,
      );
      const delay =
        Number.isFinite(raw) && raw >= 0 ? raw : 900;
      setTimeout(() => {
        try {
          if (!wc.isDestroyed()) wc.openDevTools({ mode: 'detach' });
        } catch {
          /* ignore */
        }
      }, delay);
    }
  });

  const forceTimer = setTimeout(() => {
    const win = limsPlusLiteWindow;
    if (!win || win.isDestroyed()) return;
    if (!liteShownOnce) {
      console.warn('[LimsPlus Lite] Showing window (fallback timer).');
      revealLiteWindow();
    }
  }, 2800);

  limsPlusLiteWindow.on('closed', () => {
    clearTimeout(forceTimer);
    stopLimsPortalStaticServer();
    stopLiteNestBackend();
    limsPlusLiteWindow = null;
  });

  if (isDev) {
    console.info('[LimsPlus Lite] loading portal:', portalServeUrl);
  }
  wc.loadURL(portalServeUrl).catch((err: unknown) => {
    console.error('[LimsPlus Lite] loadURL failed:', err);
    revealLiteWindow();
  });
}

ipcMain.handle(
  'prepare-and-open-limsplus-lite',
  async (event): Promise<PrepareLimsLiteResult> => {
    const wc = event.sender;
    if (!isLicenseSecurelyActivated()) {
      const msg =
        'Activate LimsPlus Connect with your license key before opening LimsPlus Lite.';
      emitLiteSetupProgress(wc, { phase: 'error', message: msg });
      return { ok: false, error: msg };
    }
    try {
      emitLitePhase(
        wc,
        1,
        'Checking frontend (client/app/frontend) and Nest Lite API (backend: main.js or dist/main.js)...',
      );

      const indexPath = getPortalBuildIndexPath();
      const backendEntryPath = getLiteBackendEntryPath();

      if (isDev && !getLiteExternalMongoUriFromEnv()) {
        console.info(
          '[LimsPlus Lite] embedded Mongo:',
          JSON.stringify(getLiteMongoPlatformSummary(), null, 0),
        );
      }

      if (!fs.existsSync(indexPath)) {
        const msg = `Portal build not found:\n${indexPath}`;
        emitLiteSetupProgress(wc, {
          phase: 'error',
          message: msg,
        });
        return {
          ok: false,
          error: msg,
          portalIndexPath: indexPath,
        };
      }

      if (!fs.existsSync(backendEntryPath)) {
        const msg = `Nest Lite API not built (missing):\n${backendEntryPath}`;
        emitLiteSetupProgress(wc, { phase: 'error', message: msg });
        return {
          ok: false,
          error: msg,
          portalIndexPath: indexPath,
          backendEntryPath,
        };
      }

      warnIfPortalUsesExternalAssets(indexPath);
      if (!app.isPackaged) {
        console.info('[LimsPlus Lite] portal index:', indexPath);
        console.info('[LimsPlus Lite] Nest API entry:', backendEntryPath);
      }

      const externalMongoUri = getLiteExternalMongoUriFromEnv();
      if (externalMongoUri) {
        emitLitePhase(
          wc,
          2,
          `Using MongoDB from LIMSPLUS_LITE_EXTERNAL_MONGO_URI (${redactMongoUriForLogs(
            externalMongoUri,
          )}) — embedded MongoDB is skipped. Ensure mongod is running.`,
        );
      } else {
        emitLitePhase(
          wc,
          2,
          `Downloading or starting MongoDB (${LIMS_LITE_MONGO_LOOPBACK_BIND}, default tcp ${LIMS_LITE_MONGO_DEFAULT_PREFERRED_PORT} — stops other listeners on that port unless LIMSPLUS_LITE_DO_NOT_KILL_OCCUPIED_MONGO_PORT=1; first launch may download server files)...`,
        );
      }

      let mongoUri: string;
      let liteMongoTcpPortForJson: number | null = null;
      if (externalMongoUri) {
        mongoUri = externalMongoUri;
        liteMongoTcpPortForJson = mongoTcpListenPortHint(mongoUri);
      } else {
        const embedded = await ensureLiteMongoRunning();
        mongoUri = embedded.mongoUri;
        liteMongoTcpPortForJson = embedded.listenPort;
      }

      emitLitePhase(
        wc,
        2,
        `Verifying MongoDB accepts connections (${redactMongoUriForLogs(mongoUri)})…`,
      );
      await waitUntilLiteMongoAcceptsConnections(mongoUri);
      if (!app.isPackaged) {
        console.info(
          '[LimsPlus Lite] Mongo ready (ping ok):',
          redactMongoUriForLogs(mongoUri),
        );
      }

      const alreadyRestored = !!store.get('limsOfflineDbRestored');

      emitLitePhase(
        wc,
        3,
        'Bundled Mongo backup (limsplus-prod.zip) — import when new/changed…',
      );

      let restoreOutcome;
      try {
        restoreOutcome = await restoreFromBundledDumpIfNeeded(
          mongoUri,
          alreadyRestored,
        );
      } catch (restoreErr: unknown) {
        console.error(restoreErr);
        const errText =
          restoreErr instanceof Error ? restoreErr.message : String(restoreErr);
        emitLiteSetupProgress(wc, { phase: 'error', message: errText });
        return {
          ok: false,
          error: errText,
        };
      }

      emitLitePhase(
        wc,
        4,
        'Starting NestJS API… This can take several minutes while the server binds and optional modules initialise. Waiting for HTTP on loopback.',
      );

      let liteApiBaseUrl: string;
      let liteApiPort: number;
      try {
        const started = await startLiteNestBackend({
          mongoUri,
          databaseName: restoreOutcome.databaseName,
        });
        liteApiBaseUrl = started.apiBaseUrl;
        liteApiPort = started.port;
        if (!app.isPackaged) {
          console.info('[LimsPlus Lite] Nest API listening:', liteApiBaseUrl);
        }
      } catch (nestErr: unknown) {
        console.error(nestErr);
        const errText =
          nestErr instanceof Error ? nestErr.message : String(nestErr);
        emitLiteSetupProgress(wc, { phase: 'error', message: errText });
        return { ok: false, error: errText };
      }

      emitLitePhase(
        wc,
        5,
        'Writing lims-lite-offline.json (Mongo + API URLs for tooling and the portal)...',
      );

      fs.writeFileSync(
        path.join(app.getPath('userData'), 'lims-lite-offline.json'),
        JSON.stringify(
          {
            mongoUri,
            database: restoreOutcome.databaseName,
            bindIp: LIMS_LITE_MONGO_LOOPBACK_BIND,
            liteMongoPort: liteMongoTcpPortForJson,
            apiBaseUrl: liteApiBaseUrl,
            liteApiPort,
            networkScope: 'loopback-only-not-exposed-outside-this-machine',
          },
          null,
          2,
        ),
      );

      const portalRoot = path.dirname(indexPath);
      try {
        const nestGraphqlUrl = `${liteApiBaseUrl.replace(/\/$/, '')}/graphql`;
        const baseUrl = await startLimsPortalStaticServer(
          portalRoot,
          nestGraphqlUrl,
        );
        const portalUrl = appendPortalLiteApiBaseQuery(
          `${baseUrl}/`,
          liteApiBaseUrl,
        );
        emitLitePhase(
          wc,
          6,
          `Frontend static server ready — opening ${portalUrl}`,
        );
        if (!app.isPackaged) {
          console.info('[LimsPlus Lite] Frontend URL:', portalUrl);
        }
        await ensureLocalLimsPlusLiteWindowOpen(portalUrl);
      } catch (serveErr: unknown) {
        stopLiteNestBackend();
        const detail =
          serveErr instanceof Error ? serveErr.message : String(serveErr);
        const msg = `Failed to start Lite portal UI server:\n${detail}`;
        emitLiteSetupProgress(wc, { phase: 'error', message: msg });
        return { ok: false, error: msg };
      }

      /** After first successful Lite prep, always use persisted embedded Mongo — not client/database/dump on every launch. */
      store.set('limsOfflineDbRestored', true);

      return {
        ok: true,
        mongoUri,
        databaseName: restoreOutcome.databaseName,
        firstRunRestore: restoreOutcome.didRestore,
      };
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      emitLiteSetupProgress(wc, {
        phase: 'error',
        message: msg,
      });
      return {
        ok: false,
        error: msg,
      };
    }
  },
);

app.on('before-quit', async (event) => {
  stopLimsPortalStaticServer();
  stopLiteNestBackend();
  if (isLiteMongoQuitHandling) {
    return;
  }
  if (!isLiteMongoServerActive()) {
    return;
  }
  isLiteMongoQuitHandling = true;
  event.preventDefault();
  try {
    await stopLiteMongoServer();
  } catch (e) {
    console.error(e);
  } finally {
    app.exit(0);
  }
});

ipcMain.handle('accessToken', async (sender, payload) => {
  store.set('accessToken', payload);
});

ipcMain.handle('read-access-token', (event) => {
  let token = store.get('accessToken');
  if (token) {
    event.sender.send('send-access-token', token);
  }
});

ipcMain.handle('user', async (sender, payload) => {
  store.set('user', payload);
});

ipcMain.handle('read-user', (event) => {
  let user = store.get('user');
  if (user) {
    event.sender.send('send-user', user);
  }
});

ipcMain.handle('remove-file', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error: any) {
    console.error('Error removing file:', error);
  }
});

ipcMain.handle('companyList', async (sender, payload) => {
  store.set('companyList', payload);
});

ipcMain.handle('read-companyList', (event) => {
  let companyList = store.get('companyList');
  if (companyList) {
    event.sender.send('send-companyList', companyList);
  }
});

ipcMain.handle('receivedMessage', async (event, payload) => {
  if (payload && Array.isArray(payload)) {
    await messageStore.set('receivedMessage', payload);
    event.sender.send('stored-received-message');
    await instrumentLogStore.appendLog(payload);
  } else {
    console.error(
      'Invalid payload: `receivedMessage` must be an array of strings.',
    );
  }
});

ipcMain.on('file:upload', async (event, opt: any) => {
  var form = new FormData();
  for (const [key, value] of Object.entries(opt)) {
    if (key === 'file') form.append('file', fs.createReadStream(opt.file));
    if (key !== 'url') form.append(key, value);
  }
  await axios
    .post(opt?.url, form, {
      headers: form.getHeaders(),
    })
    .then((response: any) => {
      const res = response.data;
      if (res.success) event.sender.send('upload:complete', res.message);
    });
  return true;
});

ipcMain.handle('check-file-exists', async (event, filePath) => {
  return fs.existsSync(filePath);
});

ipcMain.handle('open-file', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.openPath(filePath);
    return true;
  } else {
    return false;
  }
});

ipcMain.on('set-title', (event, title) => {
  if (childWindows) {
    childWindows.setTitle(title);
    childWindows.webContents.send('set-title', title); // Send title to renderer process
  }
});

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('get-license-activation-status', () => {
  migrateLegacyPlaintextFlag(!!store.get('licenseActivated'));
  if (store.get('licenseActivated')) {
    store.set('licenseActivated', false);
  }
  const forceGate =
    !app.isPackaged &&
    (process.env.LIMSPLUS_FORCE_ACTIVATION_GATE === '1' ||
      process.env.LIMSPLUS_FORCE_ACTIVATION_GATE === 'true');
  if (forceGate) {
    return { activated: false, forced: true };
  }
  const activated = isLicenseSecurelyActivated();
  if (!app.isPackaged && activated) {
    console.log(
      '[LimsPlus] Activation gate skipped — license already stored. Run `yarn reset-activation` then restart, or set LIMSPLUS_FORCE_ACTIVATION_GATE=1.',
    );
  }
  return { activated };
});

ipcMain.handle(
  'verify-activation-key',
  async (_event, activationKey: string) => {
    const result = await verifyActivationKeyViaApi(
      typeof activationKey === 'string' ? activationKey : '',
    );
    if (result.valid) {
      persistSecureActivationRecord(
        typeof activationKey === 'string' ? activationKey : '',
      );
      store.set('licenseActivated', false);
      return { ok: true, message: result.message };
    }
    return { ok: false, message: result.message };
  },
);

/** Called after REST verifies the key — stores activation proof locally (no plaintext key). */
ipcMain.handle(
  'persist-license-activation',
  (_event, activationKey: string) => {
    const key = typeof activationKey === 'string' ? activationKey.trim() : '';
    if (!key.length) {
      return { ok: false, message: 'Please enter your activation key.' };
    }
    persistSecureActivationRecord(key);
    store.set('licenseActivated', false);
    return { ok: true };
  },
);

function emitMongoBackupRestoreProgress(
  wc: WebContents,
  evt: MongoBackupRestoreProgressEvent,
): void {
  if (wc.isDestroyed()) return;
  try {
    wc.send('mongo-backup-restore-progress', evt);
  } catch {
    /* window closed */
  }
}

ipcMain.handle(
  'select-folder-dialog',
  async (
    _event,
    opts?: { title?: string; buttonLabel?: string },
  ): Promise<{ ok: boolean; path: string | null }> => {
    const result = await dialog.showOpenDialog({
      title: opts?.title ?? 'Select folder',
      buttonLabel: opts?.buttonLabel ?? 'Select',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths?.[0]) {
      return { ok: false, path: null };
    }
    return { ok: true, path: result.filePaths[0] };
  },
);

ipcMain.handle('run-mongo-backup', async (event, destinationRoot: string) => {
  const wc = event.sender;
  if (!destinationRoot?.trim()) {
    return { ok: false, error: 'No destination folder selected.' };
  }
  try {
    const alreadyRestored = !!store.get('limsOfflineDbRestored');
    const conn = await ensureLiteMongoDatabaseForMaintenance({
      isAlreadyRestored: alreadyRestored,
      operation: 'backup',
      onProgress: (e) => emitMongoBackupRestoreProgress(wc, e),
    });
    if (conn.didBundledRestore) {
      store.set('limsOfflineDbRestored', true);
    }
    const result = await exportLiteMongoDatabaseToFolder({
      mongoUri: conn.mongoUri,
      databaseName: conn.databaseName,
      destinationRoot: destinationRoot.trim(),
      onProgress: (e) => emitMongoBackupRestoreProgress(wc, e),
    });
    return {
      ok: true,
      outputDir: result.outputDir,
      dumpRoot: result.dumpRoot,
      collectionsExported: result.collectionsExported,
      documentsExported: result.documentsExported,
      databaseName: conn.databaseName,
      didBundledRestore: conn.didBundledRestore,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    emitMongoBackupRestoreProgress(wc, {
      operation: 'backup',
      phase: 'error',
      step: 0,
      totalSteps: 5,
      label: 'Backup failed',
      percent: 0,
      detail: msg,
    });
    return { ok: false, error: msg };
  }
});

ipcMain.handle('run-mongo-restore', async (event, sourceFolder: string) => {
  const wc = event.sender;
  if (!sourceFolder?.trim()) {
    return { ok: false, error: 'No backup folder selected.' };
  }
  try {
    const alreadyRestored = !!store.get('limsOfflineDbRestored');
    const conn = await ensureLiteMongoDatabaseForMaintenance({
      isAlreadyRestored: alreadyRestored,
      operation: 'restore',
      onProgress: (e) => emitMongoBackupRestoreProgress(wc, e),
    });
    const result = await restoreLiteMongoDatabaseFromFolder({
      mongoUri: conn.mongoUri,
      databaseName: conn.databaseName,
      sourceFolder: sourceFolder.trim(),
      onProgress: (e) => emitMongoBackupRestoreProgress(wc, e),
    });
    store.set('limsOfflineDbRestored', true);
    return {
      ok: true,
      documentsInserted: result.documentsInserted,
      collectionsRestored: result.collectionsRestored,
      databaseName: result.databaseName,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    emitMongoBackupRestoreProgress(wc, {
      operation: 'restore',
      phase: 'error',
      step: 0,
      totalSteps: 5,
      label: 'Restore failed',
      percent: 0,
      detail: msg,
    });
    return { ok: false, error: msg };
  }
});

ipcMain.handle('start-server', async (event, ip, tcpPort) => {
  try {
    const response = await axios.get(
      `http://localhost:9000/start-tcp?ip=${ip}&tcpPort=${tcpPort}`,
    );

    // Ensure the sender is still valid before sending a response
    if (!event.sender.isDestroyed()) {
      event.sender.send('server-message', response.data);
    }
  } catch (error: any) {
    // Ensure the sender is still valid before sending an error response
    if (!event.sender.isDestroyed()) {
      event.sender.send(
        'server-message',
        `Error starting server: ${error.message}`,
      );
    }
    console.error('Error occurred while starting server:', error.message);
  }
});

ipcMain.handle('connect-ws', (event) => {
  const wsUrl = `ws://localhost:6000/ws`;
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('ws-connected', 'WebSocket connection established');
    }
  });

  ws.on('message', (data: string) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('ws-data', data.toString());
    }
  });

  ws.on('close', () => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('ws-disconnected', 'WebSocket connection closed');
    }
  });

  ws.on('error', (error: any) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('ws-error', error.message);
    }
  });
});

ipcMain.handle('disconnect-ws', async (event, ip, tcpPort) => {
  if (ws) {
    ws.close();
    ws = null;
  } else {
    event.sender.send(
      'ws-error',
      'No active WebSocket connection to disconnect',
    );
  }

  try {
    const response = await axios.get(
      `http://localhost:9000/stop?ip=${ip}&tcpPort=${tcpPort}`,
    );
    event.sender.send('server-message', response.data);
  } catch (error: any) {
    console.error('Error stopping server:', error.message);
    event.sender.send(
      'server-message',
      `Error stopping server: ${error.message}`,
    );
  }
});

ipcMain.handle('send-ws', (event, message) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(message);
  } else {
    event.sender.send('ws-error', 'WebSocket is not connected');
  }
});

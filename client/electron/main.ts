import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Menu,
  WebContents,
  session,
} from 'electron';
import * as http from 'http';
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
  LIMS_LITE_MONGO_FIXED_PORT,
  LIMS_LITE_MONGO_LOOPBACK_BIND,
} from './offlineLimsLite';
import {
  getLiteBackendEntryPath,
  startLiteNestBackend,
  stopLiteNestBackend,
} from './liteNestBackend';
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

function startLimsPortalStaticServer(buildRootAbs: string): Promise<string> {
  return new Promise((resolve, reject) => {
    stopLimsPortalStaticServer();
    const buildRootNorm = path.resolve(buildRootAbs);

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
    mainWindow.loadURL('http://localhost:3000');
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
    childWindows.loadURL(`http://localhost:3000/#${route}`);
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
   * Lite SPA (`http://127.0.0.1:<port>`/dynamic) talks to Nest GraphQL (`http://localhost:…`/55210…) —
   * different origins ⇒ CORS preflight failures unless Nest whitelists every portal origin OR this
   * isolated window skips same-origin enforcement (recommended for offline desktop loopback only).
   * Set **`LIMSPLUS_LITE_STRICT_WEB_SECURITY=1`** to keep `webSecurity` on (then configure Nest CORS).
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
          `Downloading or starting MongoDB on ${LIMS_LITE_MONGO_LOOPBACK_BIND}:${LIMS_LITE_MONGO_FIXED_PORT} (loopback only — not reachable from other PCs; first launch may download server files)...`,
        );
      }

      let mongoUri: string;
      if (externalMongoUri) {
        mongoUri = externalMongoUri;
      } else {
        mongoUri = await ensureLiteMongoRunning();
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
        alreadyRestored
          ? 'Database already imported earlier — verifying...'
          : 'Importing backup from ZIP / database folder — first time only...',
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

      if (restoreOutcome.didRestore) {
        store.set('limsOfflineDbRestored', true);
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
            liteMongoPort: LIMS_LITE_MONGO_FIXED_PORT,
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
        const baseUrl = await startLimsPortalStaticServer(portalRoot);
        const portalUrl = `${baseUrl}/`;
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

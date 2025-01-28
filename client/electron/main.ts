import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import installExtension, {
  REACT_DEVELOPER_TOOLS,
} from 'electron-devtools-installer';

const Store = require('./store.js');
const MessageStore = require('./messageStore.js');
const InstrumentLogsStore = require('./instrumentLogsStore');
const WebSocket = require('ws');
const { spawn } = require('child_process');
let goServerProcess: any = null;

// for file upload
const fs = require('fs');
const FormData = require('form-data');
const { default: axios } = require('axios');

let mainWindow: any;
// let childWindows = [];
let childWindows: any;
let ws: WebSocket | null = null; // Define ws in a global scope

const isDev = !app.isPackaged;
process.env.NODE_ENV = 'production';

const store = new Store({
  configName: 'user-preferences',
  defaults: {
    accessToken: '',
    user: {},
    companyList: [],
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
  const user = store.get('user');
  if (user?.userId) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('user', user);
    });
  }

  if (isDev) {
    mainWindow.webContents.openDevTools();
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // DevTools
  installExtension(REACT_DEVELOPER_TOOLS)
    .then((name) => console.log(`Added Extension:  ${name}`))
    .catch((err) => console.log('An error occurred: ', err));
  createWindow();
  // app.on('activate', () => {
  //   if (BrowserWindow.getAllWindows().length === 0) {
  //     createWindow();
  //   }
  // });
  app.on('window-all-closed', () => {
    if (goServerProcess) {
      goServerProcess.kill();
      goServerProcess = null;
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
    childWindows.webContents.openDevTools();
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

  // Start the Go server
  const serverPath = isDev
    ? path.join(
        __dirname, // Development mode: relative to `electron/`
        'server',
        process.platform === 'win32' ? 'server.exe' : 'server',
      )
    : path.join(
        process.resourcesPath, // Production mode: packaged app's resources folder
        'server',
        process.platform === 'win32' ? 'server.exe' : 'server',
      );

  goServerProcess = spawn(serverPath, [], { stdio: 'inherit' });

  goServerProcess.on('error', (err: string) => {
    console.error('Failed to start Go server:', err);
  });

  goServerProcess.on('exit', (code: string) => {
    console.log(`Go server exited with code ${code}`);
  });

  // Stop the Go server when the window is closed
  childWindows.on('closed', () => {
    if (goServerProcess) {
      goServerProcess.kill();
      goServerProcess = null;
      console.log(
        'Go server stopped because the integration-gateway screen was closed.',
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

ipcMain.handle('accessToken', async (sender, payload) => {
  store.set('accessToken', payload);
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
    if (key == 'file') form.append('file', fs.createReadStream(opt.file));
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

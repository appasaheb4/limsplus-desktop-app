import {app, BrowserWindow, ipcMain, screen} from 'electron';
import * as path from 'path';
import installExtension, {
  REACT_DEVELOPER_TOOLS,
} from 'electron-devtools-installer';

const Store = require('./store.js');
const MessageStore = require('./messageStore.js');

// for file upload
const fs = require('fs');
const FormData = require('form-data');
const {default: axios} = require('axios');

let mainWindow: any;
let childWindows: any;

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: isDev ? 1424 : 1024,
    height: 768,
    // frame: true,
    resizable: false,
    icon: path.join(__dirname, '../assets/icon.ico'),
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
  childWindows.maximize();
  if (isDev) {
    childWindows.webContents.openDevTools();
    childWindows.loadURL(`http://localhost:3000/#${route}`);
  } else {
    childWindows.loadFile(path.join(__dirname, '../index.html'), {
      hash: route,
    });
  }
});

ipcMain.on('navigate-to-iframe-screen', (event, url) => {
  childWindows = new BrowserWindow({
    parent: mainWindow,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  childWindows.maximize();
  if (isDev) {
    childWindows.loadURL(url);
  }
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
  await messageStore.set('receivedMessage', payload);
  event.sender.send('stored-received-message');
  // .then(() => {
  //   event.sender.send('stored-received-message');
  // });
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

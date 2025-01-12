const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');

const Store = require('./electron/store.js');
const MessageStore = require('./electron/messageStore.js');

// for file upload
const fs = require('fs');
const FormData = require('form-data');
const {default: axios} = require('axios');

let mainWindow;
let childWindows;

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

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: isDev ? 1424 : 1024,
    height: 768,
    minWidth: 1024,
    minHeight: 768,
    frame: true,
    resizable: false,
    icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  //mainWindow.setResizable(false);
  try {
    const user = store.get('user');
    if (user?.userId) {
      mainWindow.loadFile(
        path.join(__dirname, 'src/modules/home', 'home.screen.html')
      );
    } else {
      mainWindow.loadFile(
        path.join(__dirname, 'src/modules/login', 'login.screen.html')
      );
    }
  } catch (error) {
    console.log({error});
  }
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
};

ipcMain.on('navigate-to-home-screen', (event) => {
  mainWindow.loadFile(
    path.join(__dirname, 'src/modules/home', 'home.screen.html')
  );
});

ipcMain.on('navigate-to-second-screen', (event) => {
  // mainWindow.setResizable(true);
  // mainWindow.maximize();
  // setTimeout(() => {
  //   mainWindow.setResizable(false);
  // }, 1000);
  childWindows = new BrowserWindow({
    parent: mainWindow,
    // modal: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  childWindows.maximize();
  if (isDev) {
    childWindows.webContents.openDevTools();
  }
  childWindows.loadFile(
    path.join(
      __dirname,
      'src/modules/integration-gateway',
      'integration-gateway.screen.html'
    )
  );
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
  messageStore.set('receivedMessage', payload).then(() => {
    event.sender.send('stored-received-message');
  });
});

ipcMain.on('file:upload', async (event, opt) => {
  var form = new FormData();
  form.append('file', fs.createReadStream(opt.file));
  for (const [key, value] of Object.entries(opt)) {
    if (key !== 'file' || key !== 'url') form.append(key, value);
  }
  await axios
    .post(opt?.url, form, {
      headers: form.getHeaders(),
    })
    .then((response) => {
      const res = response.data;
      if (res.success) event.sender.send('upload:complete', res.message);
    });
  return true;
});

app.whenReady().then(() => {
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length == 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (mongodProcess) {
    mongodProcess.kill('SIGINT');
  }
});

app.on('before-quit', () => {
  stopServer();
});

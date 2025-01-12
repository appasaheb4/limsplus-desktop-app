const {contextBridge, ipcRenderer} = require('electron');
const os = require('os');

contextBridge.exposeInMainWorld('electron', {
  homeDir: () => os.homedir(),
  osVersion: () => os.arch(),
});

contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) =>
    ipcRenderer.on(channel, (event, ...args) => func(event, ...args)),
});

window.addEventListener('DOMContentLoaded', () => {
  const {
    connectWS,
    sendWS,
    disconnectWS,
    onWSData,
    onWSConnected,
    onWSDisconnected,
    onWSError,
  } = window.api;

  document.getElementById('connectButton').addEventListener('click', () => {
    const ip = document.getElementById('ip').value;
    const port = document.getElementById('port').value;
    connectWS(ip, port);
  });

  document.getElementById('disconnectButton').addEventListener('click', () => {
    disconnectWS();
  });

  document.getElementById('sendButton').addEventListener('click', () => {
    const message = 'Message to send';
    sendWS(message);
  });

  onWSData((data) => {
    console.log('Received:', data);
  });

  onWSConnected((data) => {
    console.log(data);
  });

  onWSDisconnected((data) => {
    console.log(data);
  });

  onWSError((data) => {
    console.error(data);
  });
});

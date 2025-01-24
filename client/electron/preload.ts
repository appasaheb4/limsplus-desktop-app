const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  connectWS: (ip: string, port: any) =>
    ipcRenderer.invoke('connect-ws', ip, port),
  sendWS: (message: any) => ipcRenderer.invoke('send-ws', message),
  disconnectWS: () => ipcRenderer.invoke('disconnect-ws'),
  onWSData: (callback: any) =>
    ipcRenderer.on('ws-data', (event, data) => callback(data)),
  onWSConnected: (callback: any) =>
    ipcRenderer.on('ws-connected', (event, data) => callback(data)),
  onWSDisconnected: (callback: any) =>
    ipcRenderer.on('ws-disconnected', (event, data) => callback(data)),
  onWSError: (callback: any) =>
    ipcRenderer.on('ws-error', (event, data) => callback(data)),
  saveData: (username: any) => {
    let data = { username };
    console.log(data);
  },
});

// window.addEventListener('DOMContentLoaded', () => {
//   ipcRenderer.on('set-title', (event, title) => {
//     document.title = title; // Set the document title
//     const titleElement = document.getElementById('title');
//     if (titleElement) {
//       titleElement.innerText = title; // Update the title element in the HTML
//     }
//   });
// });

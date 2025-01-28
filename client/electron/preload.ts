const { contextBridge, ipcRenderer } = require('electron');

// Import Electron types
import { IpcRendererEvent } from 'electron';

// Define types
type Callback<T = any> = (data: T, event?: IpcRendererEvent) => void;

contextBridge.exposeInMainWorld('api', {
  connectWS: (ip: string, port: string): Promise<void> =>
    ipcRenderer.invoke('connect-ws', ip, port),
  sendWS: (message: string): Promise<void> =>
    ipcRenderer.invoke('send-ws', message),
  disconnectWS: (): Promise<void> => ipcRenderer.invoke('disconnect-ws'),
  onWSData: (callback: Callback<string>): void =>
    ipcRenderer.on('ws-data', (event: IpcRendererEvent, data: string) =>
      callback(data, event),
    ),
  onWSConnected: (callback: Callback<string>): void =>
    ipcRenderer.on('ws-connected', (event: IpcRendererEvent, data: string) =>
      callback(data, event),
    ),
  onWSDisconnected: (callback: Callback<string>): void =>
    ipcRenderer.on('ws-disconnected', (event: IpcRendererEvent, data: string) =>
      callback(data, event),
    ),
  onWSError: (callback: Callback<string>): void =>
    ipcRenderer.on('ws-error', (event: IpcRendererEvent, data: string) =>
      callback(data, event),
    ),
  saveData: (username: string): void => {
    let data = { username };
    console.log(data);
  },
});

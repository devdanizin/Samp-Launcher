const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  selectGTAPath: () => ipcRenderer.invoke('selectGTAPath'),
  getConfig: () => ipcRenderer.invoke('getConfig'),
  connectServer: (ip, port, username) => ipcRenderer.invoke('connectServer', { ip, port, username }),
  stopServer: () => ipcRenderer.invoke('stopServer'),
  onServerProcessExited: (callback) => ipcRenderer.on('server-process-exited', callback),
  queryServer: (ip, port) => ipcRenderer.invoke('queryServer', { ip, port }),
});

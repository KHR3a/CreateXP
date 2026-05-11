const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  login: (email, password) => ipcRenderer.invoke('auth-login', { email, password }),
  logout: () => ipcRenderer.invoke('auth-logout'),
  onAuthStateChanged: (callback) => ipcRenderer.on('auth-state-changed', (_event, user) => callback(user)),
  onUpdateState: (callback) => ipcRenderer.on('update-state', (_event, value) => callback(value)),
  onNewLog: (callback) => ipcRenderer.on('new-log', (_event, value) => callback(value))
});

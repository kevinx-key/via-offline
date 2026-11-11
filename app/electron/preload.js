// Minimal, sandboxed bridge for the renderer. No Node APIs are exposed.
const {contextBridge, ipcRenderer} = require('electron');

const subscribe = (channel, callback) => {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('viaNative', {
  isElectron: true,
  platform: process.platform,
  appVersion: process.env.VIA_APP_VERSION || '',
  startGlobalCapture: () => ipcRenderer.invoke('global-capture:start'),
  stopGlobalCapture: () => ipcRenderer.invoke('global-capture:stop'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('window:always-on-top', !!value),
  setZoom: (value) => ipcRenderer.invoke('window:set-zoom', Number(value)),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onWindowMaximizedChange: (callback) =>
    subscribe('window:maximized', callback),
  onHidSelectionChanged: (callback) =>
    subscribe('hid:selection-changed', callback),

  onGlobalKey: (callback) => subscribe('global-capture:key', callback),
  onGlobalCaptureEnded: (callback) =>
    subscribe('global-capture:ended', callback),
  onGlobalCaptureReady: (callback) =>
    subscribe('global-capture:ready', callback),
});

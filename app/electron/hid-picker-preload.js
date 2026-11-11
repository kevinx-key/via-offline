const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('hidPicker', {
  list: () => ipcRenderer.invoke('hid-picker:list'),
  choose: (deviceId) => ipcRenderer.invoke('hid-picker:choose', deviceId),
  rescan: () => ipcRenderer.invoke('hid-picker:rescan'),
  cancel: () => ipcRenderer.invoke('hid-picker:cancel'),
});

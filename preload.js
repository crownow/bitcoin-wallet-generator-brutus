const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  send: (channel, data) => ipcRenderer.send(channel, data),

  receive: (channel, func) => {
    ipcRenderer.removeAllListeners(channel); // Убираем старые обработчики, чтобы не дублировать
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },

  once: (channel, func) => {
    ipcRenderer.once(channel, (event, ...args) => func(...args));
  },

  stopProcessing: () => ipcRenderer.send("stop-processing"),
  resumeProcessing: (phrases) => ipcRenderer.send("resume-processing", phrases),
});

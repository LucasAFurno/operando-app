import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('operandoDesktop', {
  isDesktop: true,
  initialize: (seedState) => ipcRenderer.sendSync('operando:initialize', seedState),
  loadSnapshot: () => ipcRenderer.sendSync('operando:loadSnapshot'),
  saveSnapshot: (snapshot) => ipcRenderer.sendSync('operando:saveSnapshot', snapshot),
  exportPdf: (payload) => ipcRenderer.invoke('operando:exportPdf', payload),
})

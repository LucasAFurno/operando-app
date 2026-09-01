import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, promises as fs } from 'node:fs'
import { createLocalDatabase } from './local-db.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const indexPath = path.join(root, 'dist', 'index.html')
const preloadPath = path.join(__dirname, 'preload.mjs')

let localDatabase

const getDatabase = () => {
  if (localDatabase) return localDatabase
  const dbPath = path.join(app.getPath('userData'), 'data', 'operando-control.sqlite')
  localDatabase = createLocalDatabase(dbPath)
  return localDatabase
}

const registerIpc = () => {
  ipcMain.on('operando:initialize', (event, seedState) => {
    event.returnValue = getDatabase().initialize(seedState)
  })

  ipcMain.on('operando:loadSnapshot', (event) => {
    event.returnValue = getDatabase().loadState()
  })

  ipcMain.on('operando:saveSnapshot', (event, snapshot) => {
    event.returnValue = getDatabase().saveSnapshot(snapshot)
  })

  ipcMain.handle('operando:exportPdf', async (_event, payload) => {
    const pdfWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
      },
    })

    try {
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.html)}`)
      const pdf = await pdfWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: payload.pageSize || 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      })
      const target = path.join(app.getPath('downloads'), payload.filename || 'comprobante.pdf')
      await fs.writeFile(target, pdf)
      return { ok: true, path: target }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'No se pudo exportar el PDF.' }
    } finally {
      pdfWindow.destroy()
    }
  })
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: preloadPath,
    },
  })

  if (!existsSync(indexPath)) {
    win.loadURL(`data:text/html,
      <html>
        <body style="font-family:sans-serif;padding:24px">
          <h1>Falta compilar la app</h1>
          <p>Ejecuta <code>npm run build</code> o <code>npm run desktop:start</code>.</p>
        </body>
      </html>`)
    return
  }

  win.loadFile(indexPath)
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

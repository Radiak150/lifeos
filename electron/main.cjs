const { app, BrowserWindow, protocol, net, shell, session } = require('electron')
const { resolve, join, extname, sep } = require('node:path')
const { pathToFileURL } = require('node:url')
const { stat } = require('node:fs/promises')

// Stable private profile: updates replace the app, never the patient's records.
app.setName('LifeOS')
app.setPath('userData', join(app.getPath('appData'), 'LifeOS'))
protocol.registerSchemesAsPrivileged([{ scheme: 'lifeos', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }])
const isLocal = raw => { try { const u = new URL(raw); return u.protocol === 'lifeos:' && u.host === 'app' } catch { return false } }
let mainWindow
function openExternal(raw) {
  try { if (new URL(raw).protocol === 'https:') void shell.openExternal(raw) } catch { /* Unknown schemes never reach the OS. */ }
}
async function createWindow() {
  mainWindow = new BrowserWindow({ width: 1240, height: 880, minWidth: 360, minHeight: 640, title: 'LifeOS', backgroundColor: '#f5f4ef', autoHideMenuBar: true, icon: join(__dirname, '../dist/pwa-512x512.png'), webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false } })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' } })
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!isLocal(url)) { event.preventDefault(); openExternal(url) } })
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault())
  await mainWindow.loadURL('lifeos://app/')
}
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus() } })
  app.whenReady().then(async () => {
    const root = resolve(__dirname, '../dist')
    protocol.handle('lifeos', async request => {
      try {
        const url = new URL(request.url)
        if (!isLocal(request.url) || request.method !== 'GET') return new Response('Forbidden', { status: 403 })
        let file = resolve(root, '.' + decodeURIComponent(url.pathname).replaceAll('\\', '/'))
        if (file !== root && !file.startsWith(root + sep)) return new Response('Forbidden', { status: 403 })
        const info = await stat(file).catch(() => null)
        if (!info?.isFile()) {
          if (extname(file)) return new Response('Not found', { status: 404 })
          file = join(root, 'index.html')
        }
        const result = await net.fetch(pathToFileURL(file).href)
        const headers = new Headers(result.headers)
        headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
        headers.set('Referrer-Policy', 'no-referrer')
        headers.set('X-Content-Type-Options', 'nosniff')
        return new Response(result.body, { status: result.status, headers })
      } catch { return new Response('Bad request', { status: 400 }) }
    })
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    await createWindow()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow() })
  })
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

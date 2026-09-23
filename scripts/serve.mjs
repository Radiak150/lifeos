import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export function makeServer(root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist'), sharingApi, publicOrigin) {
  const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8' }
  return createServer(async (request, response) => {
    if (sharingApi && await sharingApi.handle(request, response)) return
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return }
    const host = request.headers.host?.split(':')[0]
    const hosts = ['127.0.0.1', 'localhost', ...(publicOrigin ? [new URL(publicOrigin).hostname] : [])]
    if (!hosts.includes(host)) { response.writeHead(403); response.end(); return }
    if (request.url.startsWith('/api/')) { response.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'}); response.end(JSON.stringify({error:'Compartilhamento não configurado nesta hospedagem.'})); return }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
      let file = resolve(root, '.' + pathname.replaceAll('\\', '/'))
      if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403); response.end(); return }
      let info = await stat(file).catch(() => null)
      if (!info?.isFile()) {
        if (extname(file)) { response.writeHead(404); response.end(); return }
        file = resolve(root, 'index.html'); info = await stat(file)
      }
      response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': info.size,
        'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy':'no-referrer',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https: http://127.0.0.1:*; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" })
      if (request.method === 'HEAD') response.end()
      else createReadStream(file).on('error', () => response.destroy()).pipe(response)
    } catch { response.writeHead(400); response.end() }
  })
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || process.env.LIFEOS_PORT || 5181)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Porta inválida')
  let sharingApi
  const publicOrigin = process.env.LIFEOS_PUBLIC_ORIGIN
  if (publicOrigin && (new URL(publicOrigin).protocol !== 'https:' || new URL(publicOrigin).origin !== publicOrigin)) throw new Error('LIFEOS_PUBLIC_ORIGIN deve ser uma origem HTTPS, sem caminho ou barra final.')
  if (process.env.LIFEOS_ENCRYPTION_KEY) {
    const { createSharingApi } = await import('./sharing-api.mjs')
    sharingApi = await createSharingApi({ directory:resolve(process.env.LIFEOS_DATA_DIR || 'private-sharing'), encryptionKey:process.env.LIFEOS_ENCRYPTION_KEY, publishKey:process.env.LIFEOS_PUBLISH_KEY, origins:[publicOrigin, `http://127.0.0.1:${port}`, 'http://127.0.0.1:5181', 'lifeos://app', 'https://localhost'].filter(Boolean) })
  }
  makeServer(undefined, sharingApi, publicOrigin).listen(port, publicOrigin ? '0.0.0.0' : '127.0.0.1', () => console.log(`LifeOS: ${publicOrigin || `http://127.0.0.1:${port}`}`))
}

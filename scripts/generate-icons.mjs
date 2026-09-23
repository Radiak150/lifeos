import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const sharp = process.env.LIFEOS_SHARP_PATH ? require(process.env.LIFEOS_SHARP_PATH) : require('sharp')
const source = await readFile(resolve('public/favicon.svg'))
for (const [name, size] of [['pwa-64x64.png',64],['pwa-192x192.png',192],['pwa-512x512.png',512],['maskable-icon-512x512.png',512],['apple-touch-icon-180x180.png',180]]) {
  await sharp(source).resize(size,size).png().toFile(resolve('public',name))
}
// PNG-backed ICO, supported by current Windows and Chromium.
const png = await sharp(source).resize(256,256).png().toBuffer()
const header = Buffer.alloc(22)
header.writeUInt16LE(1,2); header.writeUInt16LE(1,4); header.writeUInt16LE(1,10); header.writeUInt16LE(32,12)
header.writeUInt32LE(png.length,14); header.writeUInt32LE(22,18)
await writeFile(resolve('public/favicon.ico'),Buffer.concat([header,png]))
console.log('Ícones LifeOS atualizados.')

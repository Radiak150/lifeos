import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const target = join(root, 'release', 'LifeOS-Windows')
await mkdir(join(target, 'scripts'), { recursive: true })
await cp(join(root, 'dist'), join(target, 'dist'), { recursive: true })
for (const file of ['ABRIR-LIFEOS.cmd', 'INICIAR-LIFEOS.ps1']) await cp(join(root, file), join(target, file))
await cp(join(root, 'scripts', 'serve.mjs'), join(target, 'scripts', 'serve.mjs'))
await cp(join(root, 'scripts', 'sharing-api.mjs'), join(target, 'scripts', 'sharing-api.mjs'))
await cp(join(root, 'docs', 'PUBLICAR-ONLINE.md'), join(target, 'PUBLICAR-ONLINE.md'))
await cp(join(root, 'docs', 'LEIA-ME-OFFLINE.txt'), join(target, 'LEIA-ME.txt'))
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'))
let licenses = 'LifeOS - avisos de componentes de terceiros\nVersoes conforme package-lock.json.\nO Node.js tem licenca separada em runtime/LICENSE-Node.txt.\n\n'
for (const [path, data] of Object.entries(lock.packages)) {
  if (!path || data.dev) continue
  licenses += `\n${path}: ${data.version} - ${data.license || 'ver texto abaixo'}\n`
  const files = await readdir(join(root, path)).catch(() => [])
  for (const file of files.filter(f => /^(licen[sc]e|copying|ofl|notice)([.-]|$)/i.test(f))) {
    const content = await readFile(join(root, path, file), 'utf8').catch(() => '')
    licenses += content + '\n'
  }
}
await writeFile(join(target, 'LICENCAS-DEPENDENCIAS.txt'), licenses)
console.log('Pacote preparado em ' + target)

import { randomBytes, createHash, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto'
import { mkdir, readFile, writeFile, rename, readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'

const hash = value => createHash('sha256').update(value).digest('hex')
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
const token = () => randomBytes(32).toString('base64url')
const maxBytes = 250_000

/** Serviço para um piloto controlado. A chave de publicação é emitida pelo responsável pela hospedagem. */
export async function createSharingApi({ directory, encryptionKey, publishKey, origins = [], maxShares = 100 }) {
  const key = Buffer.from(encryptionKey || '', 'hex')
  if (!/^[a-f0-9]{64}$/i.test(encryptionKey || '') || key.length !== 32 || !publishKey || publishKey.length < 16) throw new Error('Configure LIFEOS_ENCRYPTION_KEY (64 hex) e LIFEOS_PUBLISH_KEY (mínimo 16 caracteres).')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const clients = new Map(), limits = new Map(), locks = new Map()
  const path = id => join(directory, `${id}.json`)
  const encode = record => {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(record)), cipher.final()])
    return JSON.stringify({ iv:iv.toString('hex'), tag:cipher.getAuthTag().toString('hex'), value:encrypted.toString('base64') })
  }
  const load = async id => {
    const envelope = JSON.parse(await readFile(path(id), 'utf8'))
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv,'hex'))
    decipher.setAuthTag(Buffer.from(envelope.tag,'hex'))
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.value,'base64')),decipher.final()]).toString())
  }
  const save = async (id, record) => {
    const temporary = path(id) + '.tmp'
    await writeFile(temporary, encode(record), { mode:0o600 }); await rename(temporary, path(id))
  }
  const serial = async (id, action) => {
    const previous = locks.get(id) || Promise.resolve()
    const next = previous.catch(() => {}).then(action); locks.set(id,next)
    try { return await next } finally { if(locks.get(id) === next) locks.delete(id) }
  }
  const emit = (id, type, payload) => {
    for (const response of clients.get(id) || []) response.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`)
  }
  const readBody = async request => {
    const parts = []; let size = 0
    for await (const chunk of request) { size += chunk.length; if (size > maxBytes) throw new Error('size'); parts.push(chunk) }
    return JSON.parse(Buffer.concat(parts).toString('utf8'))
  }
  const validSnapshot = snapshot => {
    if (!snapshot || snapshot.version !== 1 || typeof snapshot.alias !== 'string' || snapshot.alias.length > 60 || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.throughDate || '') || !Array.isArray(snapshot.sections) || !snapshot.sections.length || snapshot.sections.some(x => !['habits','sleep','checkins','notes'].includes(x))) throw new Error('snapshot')
    // Rejeita campos extras que poderiam incluir backup, perfil, credenciais ou dados não escolhidos.
    const allowed = new Set(['version','alias','throughDate','sections','days','habits','sleep','checkins','notes'])
    if (Object.keys(snapshot).some(k => !allowed.has(k))) throw new Error('snapshot')
    for (const section of ['habits','sleep','checkins','notes']) if (!Array.isArray(snapshot[section]) || snapshot[section].length > 1000 || (!snapshot.sections.includes(section) && snapshot[section].length)) throw new Error('snapshot')
    if (!Array.isArray(snapshot.days) || snapshot.days.length > 31 || (!snapshot.sections.includes('habits') && snapshot.days.length)) throw new Error('snapshot')
    const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value
    if (!date(snapshot.throughDate) || new Set(snapshot.sections).size !== snapshot.sections.length) throw new Error('snapshot')
    const start = new Date(snapshot.throughDate); start.setUTCDate(start.getUTCDate()-29)
    const first = start.toISOString().slice(0,10)
    const number = (value, max) => value === null || (Number.isFinite(value) && value >= 0 && value <= max)
    const rating = value => value === null || (Number.isInteger(value) && value >= 1 && value <= 5)
    const text = (value, max) => typeof value === 'string' && value.length <= max
    const schemas = {
      days: {date,percentage:v=>number(v,100)},
      habits: {date,name:v=>text(v,500),status:v=>['done','partial','missed','skipped'].includes(v)},
      sleep: {date,minutes:v=>number(v,2880),quality:rating},
      checkins: {date,mood:rating,energy:rating,overload:rating},
      notes: {date,content:v=>text(v,20000)},
    }
    for (const [section,schema] of Object.entries(schemas)) for (const row of snapshot[section]) {
      if (!row || typeof row !== 'object' || Object.keys(row).length !== Object.keys(schema).length || Object.entries(schema).some(([field,check])=>!check(row[field])) || row.date < first || row.date > snapshot.throughDate) throw new Error('snapshot')
    }
    return snapshot
  }
  const cleanup = async () => {
    for (const file of await readdir(directory)) {
      if (!/^[a-f0-9]{32}\.json$/.test(file)) continue
      const id=file.slice(0,-5)
      await serial(id,async()=> { try { const record = await load(id); if(Date.parse(record.expiresAt)<=Date.now()) { emit(id,'revoked',{}); for(const c of clients.get(id)||[]) c.end(); await unlink(path(id)) } } catch { /* Falha isolada não remove arquivos não verificáveis. */ } })
    }
  }
  const timer = setInterval(()=>void cleanup().catch(()=>{}),60_000); timer.unref()
  return {
    close() { clearInterval(timer); for(const list of clients.values()) for(const response of list) response.end() },
    async handle(request,response) {
      const url = new URL(request.url,'http://local')
      if (!url.pathname.startsWith('/api/shares')) return false
      const json = (status,data) => { response.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}); response.end(JSON.stringify(data)) }
      response.setHeader('Cache-Control','no-store'); response.setHeader('X-Content-Type-Options','nosniff'); response.setHeader('Referrer-Policy','no-referrer')
      const origin=request.headers.origin
      if(origin && !origins.includes(origin)) { json(403,{error:'Origem não autorizada.'}); return true }
      if(origin) { response.setHeader('Access-Control-Allow-Origin',origin); response.setHeader('Vary','Origin') }
      if(request.method==='OPTIONS') { response.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS'); response.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type'); response.writeHead(204); response.end(); return true }
      const address=request.socket.remoteAddress || 'local', now=Date.now()
      if(limits.size>1000) for(const [ip,entry] of limits) if(entry.until<now) limits.delete(ip)
      const entry=limits.get(address)
      if(!entry || entry.until<now) limits.set(address,{count:1,until:now+60_000})
      else if(++entry.count>180) { json(429,{error:'Aguarde um minuto antes de tentar novamente.'}); return true }
      const credential=request.headers.authorization?.replace(/^Bearer /,'') || ''
      try {
        if(url.pathname==='/api/shares' && request.method==='POST') {
          if(!equal(hash(credential),hash(publishKey))) { json(401,{error:'Código de publicação inválido.'}); return true }
          if((await readdir(directory)).filter(x=>x.endsWith('.json')).length>=maxShares) { json(503,{error:'Limite do piloto atingido.'}); return true }
          const body=await readBody(request), snapshot=validSnapshot(body.snapshot)
          const id=randomBytes(16).toString('hex'), ownerToken=token(), readerToken=token()
          const record={ownerHash:hash(ownerToken),readerHash:hash(readerToken),expiresAt:new Date(now+7*86400_000).toISOString(),updatedAt:new Date(now).toISOString(),revision:1,snapshot}
          await serial(id,()=>save(id,record))
          json(201,{id,ownerToken,readerToken,expiresAt:record.expiresAt,updatedAt:record.updatedAt}); return true
        }
        const match=url.pathname.match(/^\/api\/shares\/([a-f0-9]{32})(\/events)?$/)
        if(!match) { json(404,{error:'Link indisponível.'}); return true }
        const [,id,events]=match
        await serial(id,async()=> {
          let record; try {record=await load(id)} catch {json(404,{error:'Link indisponível ou revogado.'});return}
          const owner=equal(hash(credential),record.ownerHash), reader=equal(hash(credential),record.readerHash)
          if(!owner && !reader) {json(403,{error:'Link ou chave inválidos.'});return}
          if(Date.parse(record.expiresAt)<=now && !(owner && request.method==='DELETE' && !events)) {json(410,{error:'Link expirado.'});return}
          if(request.method==='GET' && !events) {json(200,{snapshot:record.snapshot,updatedAt:record.updatedAt,expiresAt:record.expiresAt,revision:record.revision});return}
          if(request.method==='GET' && events) {
            const list=clients.get(id)||new Set()
            if(list.size>=10) {json(429,{error:'Muitas conexões para este link.'});return}
            response.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Connection':'keep-alive','X-Accel-Buffering':'no'})
            response.write(`event: snapshot\ndata: ${JSON.stringify({snapshot:record.snapshot,updatedAt:record.updatedAt,expiresAt:record.expiresAt,revision:record.revision})}\n\n`)
            list.add(response);clients.set(id,list)
            const heartbeat=setInterval(()=>response.write(': heartbeat\n\n'),15_000)
            response.on('close',()=>{clearInterval(heartbeat);list.delete(response);if(!list.size)clients.delete(id)})
            return
          }
          if(!owner) {json(403,{error:'Este link permite somente leitura.'});return}
          if(request.method==='PUT' && !events) {
            const body=await readBody(request)
            record.snapshot=validSnapshot(body.snapshot);record.updatedAt=new Date().toISOString();record.revision++
            await save(id,record)
            const result={snapshot:record.snapshot,updatedAt:record.updatedAt,expiresAt:record.expiresAt,revision:record.revision}
            emit(id,'snapshot',result);json(200,{updatedAt:record.updatedAt,revision:record.revision});return
          }
          if(request.method==='DELETE' && !events) {
            await unlink(path(id));emit(id,'revoked',{});for(const c of clients.get(id)||[]) c.end();json(200,{revoked:true});return
          }
          json(405,{error:'Operação não permitida.'})
        })
      } catch { if(!response.headersSent) json(400,{error:'Dados inválidos ou indisponibilidade de gravação.'}); else response.end() }
      return true
    },
  }
}

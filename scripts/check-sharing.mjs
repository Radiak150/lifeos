// Teste de integração com servidor real e clientes independentes; não usa dados do usuário.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { randomBytes } from 'node:crypto'
import { createSharingApi } from './sharing-api.mjs'
import { makeServer } from './serve.mjs'

const directory=await mkdtemp(join(tmpdir(),'lifeos-share-test-'))
const config={directory,encryptionKey:randomBytes(32).toString('hex'),publishKey:randomBytes(24).toString('hex'),origins:['https://lifeos.test']}
let api,server,stream
const start=async()=>{api=await createSharingApi(config);server=makeServer(undefined,api);await new Promise(r=>server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${server.address().port}`}
const stop=async()=>{api?.close();server?.closeAllConnections();await new Promise(r=>server.close(r))}
let assertions=0
const ok=name=>{assertions++;console.log('OK '+name)}
try {
  let origin=await start()
  const snapshot={version:1,alias:'Pessoa de teste',throughDate:'2026-09-16',sections:['habits'],days:[{date:'2026-09-16',percentage:0}],habits:[{date:'2026-09-16',name:'Hábito de teste',status:'partial'}],sleep:[],checkins:[],notes:[]}
  const request=(path,credential,method='GET',body)=>fetch(origin+path,{method,headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000)})
  assert.equal((await request('/api/shares','incorreto','POST',{snapshot})).status,401);ok('publicação exige autorização')
  const created=await request('/api/shares',config.publishKey,'POST',{snapshot});assert.equal(created.status,201)
  const share=await created.json(),path='/api/shares/'+share.id
  assert.match(share.readerToken,/^[\w-]{43}$/);assert.notEqual(share.readerToken,share.ownerToken)
  assert.equal((await request(path,share.readerToken)).status,200);assert.equal((await request(path,'errado')).status,403);ok('leitura autenticada por chave distinta')
  for(const method of ['PUT','DELETE'])assert.equal((await request(path,share.readerToken,method,{snapshot})).status,403);ok('leitor não altera nem revoga')
  const encrypted=await readFile(join(directory,share.id+'.json'),'utf8')
  for(const secret of ['Pessoa de teste','Hábito de teste',share.readerToken,share.ownerToken])assert.ok(!encrypted.includes(secret));ok('cópia persistida cifrada sem tokens em claro')
  const response=await fetch(origin+path+'/events',{headers:{Authorization:'Bearer '+share.readerToken},signal:AbortSignal.timeout(10000)})
  assert.equal(response.status,200);stream=response.body.getReader()
  const next=async()=>new TextDecoder().decode((await stream.read()).value)
  assert.match(await next(),/"revision":1/)
  const changed={...snapshot,days:[{date:'2026-09-16',percentage:100}],habits:[{...snapshot.habits[0],status:'done'}]}
  assert.equal((await request(path,share.ownerToken,'PUT',{snapshot:changed})).status,200)
  assert.match(await next(),/"status":"done"/);ok('segundo cliente recebe mudança por stream sem recarregar')
  for(const bad of [{...changed,profile:{name:'privado'}},{...changed,habits:[{...changed.habits[0],note:'privado'}]},{...changed,notes:[{date:'2026-09-16',content:'não autorizado'}]},{...changed,days:[{date:'2026-09-16',percentage:101}]}])assert.equal((await request(path,share.ownerToken,'PUT',{snapshot:bad})).status,400)
  ok('campos extras, seção não autorizada e valores inválidos rejeitados')
  assert.equal((await fetch(origin+path,{headers:{Origin:'https://intruso.test',Authorization:'Bearer '+share.readerToken}})).status,403);ok('origem estrangeira bloqueada')
  await stream.cancel();stream=null;await stop();origin=await start()
  const restored=await (await request(path,share.readerToken)).json();assert.equal(restored.snapshot.habits[0].status,'done');assert.equal(restored.revision,2);ok('cópia persiste após reiniciar servidor')
  const revokeStream=await fetch(origin+path+'/events',{headers:{Authorization:'Bearer '+share.readerToken},signal:AbortSignal.timeout(10000)})
  stream=revokeStream.body.getReader();await next()
  assert.equal((await request(path,share.ownerToken,'DELETE')).status,200);assert.match(await next(),/event: revoked/)
  assert.equal((await request(path,share.readerToken)).status,404);assert.deepEqual(await readdir(directory),[]);ok('revogação encerra leitura e remove a cópia remota')
  console.log(`${assertions} verificações de integração aprovadas.`)
} finally {
  await stream?.cancel().catch(()=>{});await stop()
  const target=resolve(directory),base=resolve(tmpdir())+sep
  if(!target.startsWith(base) || !target.slice(base.length).startsWith('lifeos-share-test-'))throw new Error('Diretório de teste inesperado')
  await rm(target,{recursive:true,force:true})
}

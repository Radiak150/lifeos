import type { ShareSection, ShareSnapshot } from '../domain/sharing'
export type ShareConnection = { url:string; id:string; ownerToken:string; readerToken:string; alias:string; sections:ShareSection[]; expiresAt:string }
export type ShareStatus = { phase:'off'|'pending'|'live'|'error'; message:string; sentAt?:string }
const storageKey='lifeos-share-connection-v1'
let connection:ShareConnection|null=null
export function readShareConnection():ShareConnection|null {
  try {
    const raw=localStorage.getItem(storageKey); if(!raw) return null
    const value=JSON.parse(raw) as ShareConnection
    if(shareServiceUrl(value.url)!==value.url || !/^[a-f0-9]{32}$/.test(value.id) || !/^[\w-]{43}$/.test(value.ownerToken) || !/^[\w-]{43}$/.test(value.readerToken) || !Number.isFinite(Date.parse(value.expiresAt)) || typeof value.alias!=='string' || !Array.isArray(value.sections) || !value.sections.length || value.sections.some(s=>!['habits','sleep','checkins','notes'].includes(s))) return null
    return value
  }catch{return null}
}
connection=readShareConnection()
let status:ShareStatus={phase:connection?'pending':'off',message:connection?'Aguardando conexão.':'Nenhum compartilhamento ativo.'}
const listeners=new Set<()=>void>()
export const subscribeSharing=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}}
export const getShareConnection=()=>connection
export const getShareStatus=()=>status
export function setShareStatus(next:ShareStatus) {status=next;listeners.forEach(fn=>fn())}
export function saveShareConnection(next:ShareConnection|null) {
  if(next) localStorage.setItem(storageKey,JSON.stringify(next));else localStorage.removeItem(storageKey)
  connection=next;listeners.forEach(fn=>fn())
}
export function refreshShareConnection() {connection=readShareConnection();listeners.forEach(fn=>fn())}
export function shareServiceUrl(raw:string) {
  const parsed=new URL(raw.trim())
  if(parsed.username || parsed.password || (parsed.protocol!=='https:' && !(parsed.protocol==='http:' && ['127.0.0.1','localhost'].includes(parsed.hostname)))) throw new Error('Use um endereço HTTPS. HTTP é permitido apenas no teste local.')
  if(parsed.pathname!=='/' || parsed.search || parsed.hash) throw new Error('Informe somente a origem do serviço, sem caminhos ou parâmetros.')
  return parsed.origin
}
export async function shareRequest(url:string, path:string, credential:string, method='GET', snapshot?:ShareSnapshot) {
  const result=await fetch(url+path,{method,cache:'no-store',headers:{Authorization:`Bearer ${credential}`,...(snapshot?{'Content-Type':'application/json'}:{})},...(snapshot?{body:JSON.stringify({snapshot})}:{}),signal:AbortSignal.timeout(12_000)})
  const data=await result.json().catch(()=>({error:'O endereço não oferece o serviço de compartilhamento do LifeOS.'}))
  if(method==='DELETE' && [404,410].includes(result.status) && result.headers.get('Content-Type')?.includes('application/json')) return {revoked:true}
  if(!result.ok) throw new Error(data.error||'Serviço indisponível.')
  return data
}
export function readerLink(c:ShareConnection) {return `${c.url}/shared/${c.id}#${c.readerToken}`}

import { useEffect, useSyncExternalStore } from 'react'
import { useLifeOS } from '../app/LifeOSProvider'
import { useCurrentDate } from '../hooks/useCurrentDate'
import { makeSharedSnapshot } from '../domain/sharing'
import { getShareConnection, refreshShareConnection, setShareStatus, shareRequest, subscribeSharing } from '../lib/sharing'

/** Envia apenas a seleção consentida, com a aplicação aberta. O estado local nunca depende da rede. */
export default function SharingBridge() {
  const data=useLifeOS()
  const throughDate=useCurrentDate(data.settings.timezone)
  const connection=useSyncExternalStore(subscribeSharing,getShareConnection)
  const payload=connection ? JSON.stringify(makeSharedSnapshot({...data,throughDate},connection.sections,connection.alias)) : ''
  useEffect(()=>{
    if(!connection) return
    let stopped=false, busy=false, sent='', retry:ReturnType<typeof setTimeout>|undefined
    const run=async()=>{
      if(stopped || busy || sent===payload) return
      if(Date.parse(connection.expiresAt)<=Date.now()) {setShareStatus({phase:'error',message:'Link expirado. Crie outro para continuar.'});return}
      busy=true;setShareStatus({phase:'pending',message:'Enviando seleção para a terapeuta…'})
      try {
        const result=await shareRequest(connection.url,`/api/shares/${connection.id}`,connection.ownerToken,'PUT',JSON.parse(payload))
        if(!stopped) {sent=payload;setShareStatus({phase:'live',message:'Dados selecionados enviados.',sentAt:result.updatedAt})}
      } catch(e) {if(!stopped){setShareStatus({phase:'error',message:`Salvo aqui; envio pendente. ${e instanceof Error?e.message:'Verifique a conexão.'}`});retry=setTimeout(publish,15_000)}}
      finally {busy=false}
    }
    // Serializa escritores entre abas da mesma origem quando Web Locks está disponível.
    const publish=()=> {if('locks' in navigator) void navigator.locks.request('lifeos-share-publish',run);else void run()}
    const debounce=setTimeout(publish,800)
    window.addEventListener('online',publish)
    return()=>{stopped=true;clearTimeout(debounce);clearTimeout(retry);window.removeEventListener('online',publish)}
  },[connection,payload])
  useEffect(()=>{const changed=(event:StorageEvent)=>{if(event.key===null || event.key==='lifeos-share-connection-v1')refreshShareConnection()};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed)},[])
  return null
}

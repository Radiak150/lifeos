import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Eye, Wifi, ShieldCheck } from 'lucide-react'
import { Card } from '../components/ui'
import type { ShareSnapshot } from '../domain/sharing'

type Packet={snapshot:ShareSnapshot;updatedAt:string;expiresAt:string;revision:number}
const dateLabel=(date:string)=>date.split('-').reverse().join('/')
const states:Record<string,string>={done:'Feito',partial:'Parcial',missed:'Não feito',skipped:'Dispensado'}
export default function SharedViewerPage() {
  const {shareId}=useParams()
  const [packet,setPacket]=useState<Packet|null>(null),[message,setMessage]=useState('Conectando ao compartilhamento…'),[connected,setConnected]=useState(false)
  const [token]=useState(()=>location.hash.slice(1))
  useEffect(()=>{
    if(!shareId || !/^[a-f0-9]{32}$/.test(shareId) || !/^[A-Za-z0-9_-]{43}$/.test(token))return
    let stopped=false, timer:ReturnType<typeof setTimeout>|undefined, controller:AbortController|undefined
    async function connect() {
      controller=new AbortController();let receivedAt=Date.now()
      const heartbeat=setInterval(()=>{if(Date.now()-receivedAt>45_000)controller?.abort()},15_000)
      try {
        const result=await fetch(`/api/shares/${shareId}/events`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal})
        if(!result.ok || !result.body){setPacket(null);setConnected(false);setMessage([403,404,410].includes(result.status)?'Este link é inválido, foi revogado ou expirou. Solicite outro à pessoa responsável.':'O serviço não está disponível.');if([403,404,410].includes(result.status))return;throw new Error('connection')}
        const reader=result.body.getReader(),decoder=new TextDecoder();let buffer=''
        while(!stopped) {
          const chunk=await reader.read();if(chunk.done)break;receivedAt=Date.now();buffer+=decoder.decode(chunk.value,{stream:true})
          let boundary
          while((boundary=buffer.indexOf('\n\n'))>=0) {
            const block=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2)
            const event=block.split('\n').find(l=>l.startsWith('event: '))?.slice(7)
            const data=block.split('\n').find(l=>l.startsWith('data: '))?.slice(6)
            if(event==='revoked'){setPacket(null);setConnected(false);setMessage('O compartilhamento foi encerrado pela pessoa responsável.');return}
            if(event==='snapshot' && data){setPacket(JSON.parse(data));setConnected(true);setMessage('Conectado ao serviço. Novos envios aparecerão nesta tela.');}
          }
        }
        if(!stopped){setConnected(false);setMessage('Conexão interrompida. Mostrando a última atualização recebida.');timer=setTimeout(connect,5000)}
      }catch{if(!stopped){setConnected(false);setMessage('Sem conexão. Os dados abaixo podem estar desatualizados. Tentando reconectar…');timer=setTimeout(connect,5000)}}
      finally{clearInterval(heartbeat)}
    }
    void connect()
    return()=>{stopped=true;clearTimeout(timer);controller?.abort()}
  },[shareId,token])
  const invalid=!shareId || !/^[a-f0-9]{32}$/.test(shareId) || !/^[A-Za-z0-9_-]{43}$/.test(token)
  const snapshot=packet?.snapshot
  return <main className="shared-view page guide-page"><header className="shared-header"><span className="brand-mark">L</span><div><span className="eyebrow">LifeOS · acesso compartilhado</span><h1>{snapshot?.alias || 'Acompanhamento da rotina'}</h1></div><span><Eye size={17}/>Somente leitura</span></header>
    <Card className={`share-status ${connected?'share-status--live':''}`}><Wifi size={20}/><div><strong role="status">{invalid?'O link está incompleto. Peça o endereço inteiro, incluindo o trecho após #.':message}</strong>{packet&&<p>Dados enviados em {new Date(packet.updatedAt).toLocaleString('pt-BR')} · link válido até {new Date(packet.expiresAt).toLocaleString('pt-BR')}</p>}</div></Card>
    <p className="shared-caption">Esta tela recebe somente a seleção autorizada. Não permite alterar a rotina. Conexão com o serviço não significa que o dispositivo da pessoa esteja online: confira sempre a data do último envio.</p>
    {snapshot&&<div className="shared-sections">
      {snapshot.sections.includes('habits')&&<Card><h2>Hábitos · últimos 30 dias</h2><div className="shared-days">{snapshot.days.map(d=><div key={d.date} title={`${dateLabel(d.date)}: ${d.percentage==null?'sem registro':d.percentage+'%'}`} className={d.percentage==null?'':d.percentage>=75?'good':'partial'}><span>{d.date.slice(8)}</span><b>{d.percentage==null?'—':d.percentage+'%'}</b></div>)}</div><div className="shared-table-wrap"><table><thead><tr><th>Data</th><th>Hábito</th><th>Registro</th></tr></thead><tbody>{snapshot.habits.slice().sort((a,b)=>b.date.localeCompare(a.date)).map((h,i)=><tr key={i}><td>{dateLabel(h.date)}</td><td>{h.name}</td><td>{states[h.status]||h.status}</td></tr>)}</tbody></table>{!snapshot.habits.length&&<p>Sem hábitos registrados neste período.</p>}</div></Card>}
      {snapshot.sections.includes('sleep')&&<Card><h2>Sono</h2>{snapshot.sleep.length?<div className="shared-table-wrap"><table><thead><tr><th>Data</th><th>Duração</th><th>Qualidade informada</th></tr></thead><tbody>{snapshot.sleep.map(s=><tr key={s.date}><td>{dateLabel(s.date)}</td><td>{s.minutes==null?'Em andamento':`${Math.floor(s.minutes/60)}h ${s.minutes%60}min`}</td><td>{s.quality==null?'Não informada':s.quality+'/5'}</td></tr>)}</tbody></table></div>:<p>Sem registro de sono no período.</p>}</Card>}
      {snapshot.sections.includes('checkins')&&<Card><h2>Estado do dia</h2><div className="shared-table-wrap"><table><thead><tr><th>Data</th><th>Humor</th><th>Energia</th><th>Sobrecarga</th></tr></thead><tbody>{snapshot.checkins.map(c=><tr key={c.date}><td>{dateLabel(c.date)}</td><td>{c.mood??'—'}</td><td>{c.energy??'—'}</td><td>{c.overload??'—'}</td></tr>)}</tbody></table>{!snapshot.checkins.length&&<p>Sem check-ins no período.</p>}</div><small>Escalas de 1 a 5, informadas pela pessoa. Não são diagnóstico.</small></Card>}
      {snapshot.sections.includes('notes')&&<Card><h2>Observações autorizadas</h2>{snapshot.notes.length?snapshot.notes.map((n,i)=><article className="shared-note" key={i}><time>{dateLabel(n.date)}</time><p>{n.content}</p></article>):<p>Nenhuma nota foi escolhida para compartilhar neste período.</p>}</Card>}
    </div>}
    <footer className="guide-tip"><ShieldCheck size={21}/><p>Não encaminhe este link sem autorização. Ele permite acesso a informações pessoais enquanto estiver válido. Este painel apoia a conversa e não substitui avaliação profissional.</p></footer>
  </main>
}

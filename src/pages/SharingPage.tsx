import { useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Link2, ShieldCheck, Unplug } from 'lucide-react'
import { useLifeOS } from '../app/LifeOSProvider'
import { useCurrentDate } from '../hooks/useCurrentDate'
import { makeSharedSnapshot, type ShareSection } from '../domain/sharing'
import { getShareConnection, getShareStatus, readerLink, saveShareConnection, setShareStatus, shareRequest, shareServiceUrl, subscribeSharing } from '../lib/sharing'
import { PageTabs } from '../components/PageTabs'
import { PageHeading } from '../components/PageHeading'
import { Button, Card, Field, Modal } from '../components/ui'

const choices:Array<[ShareSection,string,string]>=[['habits','Hábitos e conclusão','Nomes, datas e estados dos registros.'],['sleep','Sono','Datas, duração e qualidade informada; sem observações.'],['checkins','Estado do dia','Humor, energia e sobrecarga; sem texto livre.'],['notes','Notas escolhidas','Somente notas de terapia marcadas para compartilhar.']]
export default function SharingPage() {
  const data=useLifeOS(), throughDate=useCurrentDate(data.settings.timezone)
  const connection=useSyncExternalStore(subscribeSharing,getShareConnection), status=useSyncExternalStore(subscribeSharing,getShareStatus)
  const [step, setStep] = useState('selection')
  const [url,setUrl]=useState(connection?.url || (location.protocol==='https:'?location.origin:'')), [code,setCode]=useState(''),[alias,setAlias]=useState(connection?.alias || data.settings.profile.displayName || '')
  const [sections,setSections]=useState<ShareSection[]>(connection?.sections || []),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revoke,setRevoke]=useState(false)
  const preview=makeSharedSnapshot({...data,throughDate},sections,alias)
  async function activate() {
    setError('');setBusy(true)
    try {
      if(!consent || !sections.length)throw new Error('Escolha o que compartilhar e confirme a autorização.')
      const service=shareServiceUrl(url)
      const result=await shareRequest(service,'/api/shares',code,'POST',preview)
      saveShareConnection({url:service,id:result.id,ownerToken:result.ownerToken,readerToken:result.readerToken,expiresAt:result.expiresAt,alias,sections})
      setCode('');setShareStatus({phase:'live',message:'Link criado; somente leitura.',sentAt:result.updatedAt})
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível criar o link.')}
    finally{setBusy(false)}
  }
  async function revokeLink() {
    if(!connection)return;setBusy(true);setError('')
    try{await shareRequest(connection.url,`/api/shares/${connection.id}`,connection.ownerToken,'DELETE');saveShareConnection(null);setShareStatus({phase:'off',message:'Link revogado e dados removidos do serviço.'});setRevoke(false);setConsent(false)}
    catch(e){setError(`O link ainda NÃO foi revogado. ${e instanceof Error?e.message:'Reconecte e tente novamente.'}`)}finally{setBusy(false)}
  }
  return <div className="page calm-page">
    <PageHeading eyebrow="Acompanhamento" title="Compartilhar com a terapeuta" description="Escolha os registros. Confira a autorização. Envie o link." />
    {connection ? <Card className="share-step-panel"><span className="section-chip"><ShieldCheck size={18}/>Somente leitura</span><h2>Seu link de acompanhamento</h2><p role="status">{status.message}</p>{status.sentAt&&<p>Último envio: {new Date(status.sentAt).toLocaleString('pt-BR')}</p>}<Field label="Link da terapeuta"><input readOnly value={readerLink(connection)}/></Field><div className="category-actions"><Button onClick={async()=>{try{await navigator.clipboard.writeText(readerLink(connection));setError('Link copiado.')}catch{setError('Selecione e copie o link acima.')}}}><Copy size={16}/>Copiar link</Button><a className="button button--secondary" href={readerLink(connection)} target="_blank" rel="noreferrer">Abrir acompanhamento</a></div><p>Válido até {new Date(connection.expiresAt).toLocaleString('pt-BR')}. Envie diretamente à sua terapeuta.</p><details><summary>Dados compartilhados e acesso</summary><p>{choices.filter(([id])=>connection.sections.includes(id)).map(([,title])=>title).join(', ')}.</p><p>Para trocar a seleção, encerre este link e crie outro. Quem tem o link pode ler os dados; cópias já feitas não podem ser recolhidas.</p><Button variant="danger" disabled={busy} onClick={()=>setRevoke(true)}><Unplug size={16}/>Encerrar acesso</Button></details></Card>
    : <><PageTabs value={step} onChange={setStep} label="Preparar compartilhamento" items={[{id:'selection',label:'1. Escolher dados'},{id:'review',label:'2. Autorizar'},{id:'link',label:'3. Criar link'}]}/>
    <Card className="share-step-panel" hidden={step!=='selection'}><h2>O que você quer compartilhar?</h2><p>Registros dos últimos 30 dias. Notas pessoais ficam de fora.</p><div className="share-choices">{choices.map(([id,title,detail])=><label key={id}><input type="checkbox" checked={sections.includes(id)} onChange={e=>setSections(e.target.checked?[...sections,id]:sections.filter(x=>x!==id))}/><span><strong>{title}</strong><small>{detail}</small></span></label>)}</div><Button disabled={!sections.length} onClick={()=>setStep('review')}>Conferir seleção</Button></Card>
    <Card className="share-step-panel" hidden={step!=='review'}><h2>Confira antes de enviar</h2><Field label="Como sua terapeuta vai identificar você"><input maxLength={60} value={alias} placeholder="Nome ou identificação combinada" onChange={e=>setAlias(e.target.value)}/></Field><p>{preview.habits.length} registros de hábitos · {preview.sleep.length} de sono · {preview.checkins.length} de estado do dia · {preview.notes.length} notas.</p><p>O link permite apenas leitura, expira em 7 dias e pode ser encerrado. Envie somente à pessoa autorizada: qualquer pessoa com o link poderá acessar a seleção.</p><label className="share-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Autorizo o envio e o acesso aos registros selecionados.</span></label><footer><Button variant="ghost" onClick={()=>setStep('selection')}>Voltar</Button><Button disabled={!consent||!sections.length} onClick={()=>setStep('link')}>Continuar</Button></footer></Card>
    <Card className="share-step-panel" hidden={step!=='link'}><h2>Conectar o acompanhamento</h2><p>O envio precisa de um serviço LifeOS online. Com ele configurado, novos registros atualizam o link enquanto o aplicativo estiver aberto e conectado.</p><Field label="Endereço do serviço LifeOS"><input type="url" placeholder="https://…" value={url} onChange={e=>setUrl(e.target.value)}/></Field><Field label="Código de acesso ao serviço"><input type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)}/></Field><p>Solicite estes dados ao responsável pela instalação. Sem essa conexão, seus registros continuam salvos neste aparelho.</p><footer><Button variant="ghost" onClick={()=>setStep('review')}>Voltar</Button><Button disabled={busy||!consent||!sections.length||!url||!code} onClick={activate}><Link2 size={16}/>{busy?'Conectando…':'Gerar link'}</Button></footer></Card></>}
    {error&&<p className="form-error" role="status">{error}</p>}<p className="sharing-footnote">Sem internet, registre normalmente. O envio retoma com o LifeOS aberto e conectado. <Link to="/therapy">Abrir terapia</Link></p>
    <Modal open={revoke} title="Encerrar este acesso?" onClose={()=>setRevoke(false)} footer={<><Button variant="secondary" onClick={()=>setRevoke(false)}>Cancelar</Button><Button variant="danger" disabled={busy} onClick={revokeLink}>Encerrar acesso</Button></>}><p>O link deixará de funcionar e a cópia compartilhada será removida do serviço. Seus registros neste aparelho serão preservados.</p>{error&&<p role="alert">{error}</p>}</Modal>
  </div>
}

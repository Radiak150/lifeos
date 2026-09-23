import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowRight, CalendarDays, MoonStar, HeartHandshake, ChartNoAxesCombined, Sun, Compass } from 'lucide-react'
import { useLifeOS } from '../app/LifeOSProvider'
import { useCurrentDate } from '../hooks/useCurrentDate'
import { fromDateKey } from '../domain/date'
import { getDailyCompletion, getDueHabits } from '../domain/metrics'
export default function Dashboard(){
 const {settings,habits,habitLogs}=useLifeOS(),date=useCurrentDate(settings.timezone)
 const completion=getDailyCompletion(habits,habitLogs,date,settings)
 const due=getDueHabits(habits,date)
 const next=due.find(h=>!habitLogs.some(l=>l.habitId===h.id&&l.date===date&&l.status==='done'))
 const tiles=[{to:'/calendar',title:'Minha agenda',text:'Datas e compromissos',icon:CalendarDays,tone:'blue'},{to:'/sleep',title:'Meu descanso',text:'Registrar e conhecer o sono',icon:MoonStar,tone:'purple'},{to:'/sharing',title:'Minha terapeuta',text:'Compartilhar o acompanhamento',icon:HeartHandshake,tone:'coral'},{to:'/stats',title:'Minha evolução',text:'Olhar para os últimos dias',icon:ChartNoAxesCombined,tone:'green'}]
 return <div className="page home-calm"><header className="home-greeting"><div><span className="eyebrow">{format(fromDateKey(date),"EEEE, d 'de' MMMM",{locale:ptBR})}</span><h1>Olá{settings.profile.displayName?`, ${settings.profile.displayName.split(' ')[0]}`:''}. <span>Vamos por partes.</span></h1></div><Link to="/guide" className="quiet-link"><Compass size={18}/>Meu guia</Link></header>
 <section className="home-focus"><div className="home-focus__copy"><span className="section-chip"><Sun size={17}/>Seu dia, agora</span><h2>{next?'Um próximo passo.':due.length?'Espaço para o resto do dia.':'Por onde você quer começar?'}</h2><p>{next?next.minimumVersion:due.length?'Seus hábitos de hoje estão em dia. Você pode registrar como se sente.':'Escolha um cuidado para acompanhar. Sua rotina pode crescer aos poucos.'}</p><Link className="button button--primary" to={habits.length?'/today':'/habits?new=1'}>{habits.length?'Abrir meu dia':'Escolher um hábito'}<ArrowRight size={18}/></Link><small>{completion.recordedCount?`${completion.doneCount} de ${completion.dueCount} hábitos concluídos hoje`:'Cada registro fica salvo automaticamente.'}</small></div><img src="/visuals/lifeos-daily-v2.png" alt="Agenda, copo de água e tecido sobre uma bandeja, iluminados pela manhã"/></section>
 <section className="home-paths" aria-label="Escolha o que deseja abrir"><div className="section-heading"><h2>O que você precisa agora?</h2><span>Um assunto de cada vez.</span></div><div className="home-path-grid">{tiles.map(({to,title,text,icon:Icon,tone})=><Link to={to} className={`home-path home-path--${tone}`} key={to}><span className="path-icon"><Icon size={25}/></span><div><h3>{title}</h3><p>{text}</p></div><ArrowRight size={18}/></Link>)}</div></section></div>
}

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { differenceInCalendarDays, endOfWeek, format, parseISO, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Brain, CalendarClock, Download, Edit3, Eye, EyeOff, LockKeyhole, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useLifeOS } from '../app/LifeOSProvider'
import { PageTabs } from '../components/PageTabs'
import { PageHeading } from '../components/PageHeading'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Modal } from '../components/ui'
import { fromDateKey, toDateKey } from '../domain/date'
import { getLastNDaysMetrics } from '../domain/metrics'
import { getNextOccurrence } from '../domain/schedule'
import type { TherapyNote } from '../domain/types'
import { useCurrentDate } from '../hooks/useCurrentDate'

function average(values: Array<number | undefined>) {
  const valid = values.filter((value): value is number => value != null)
  return valid.length ? Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10 : null
}

export default function TherapyPage() {
  const { habits, habitLogs, sleepLogs, waterLogs, dayCheckIns, scheduleItems, therapyNotes, settings, saveTherapyNote, removeTherapyNote } = useLifeOS()
  const today = useCurrentDate(settings.timezone)
  const todayDate = fromDateKey(today)
  const weekStartDate = startOfWeek(todayDate, { weekStartsOn: settings.weekStartsOn })
  const weekEndDate = endOfWeek(todayDate, { weekStartsOn: settings.weekStartsOn })
  const weekStart = toDateKey(weekStartDate)
  const weekEnd = toDateKey(weekEndDate)
  const daysInCurrentWeek = differenceInCalendarDays(todayDate, weekStartDate) + 1
  const weekMetrics = getLastNDaysMetrics({ habits, habitLogs, sleepLogs, waterLogs, endDate: today, days: daysInCurrentWeek, settings })
  const weekCheckIns = dayCheckIns.filter((check) => check.date >= weekStart && check.date <= weekEnd)
  const averageEnergy = average(weekCheckIns.map((check) => check.energy))
  const averageOverload = average(weekCheckIns.map((check) => check.overload))
  const difficultDays = weekCheckIns.filter((check) => check.difficultDay || (check.difficulty ?? 0) >= 4).length
  const nextTherapy = scheduleItems
    .filter((item) => item.category === 'therapy' && item.active)
    .map((item) => ({ item, date: getNextOccurrence(item, new Date(), settings.timezone) }))
    .filter((entry): entry is { item: typeof entry.item; date: Date } => entry.date != null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0]
  const therapySchedule = nextTherapy?.item
  const nextSession = nextTherapy?.date ?? null
  const recurrenceLabel = therapySchedule?.recurrence.type === 'weekly'
    ? `Semanal · ${therapySchedule.recurrence.weekdays.map((day) => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][day]).join(', ')}`
    : therapySchedule?.recurrence.type === 'daily' ? 'Todos os dias' : 'Sessão pontual'
  const [tab, setTab] = useState('summary')
  const [noteOpen, setNoteOpen] = useState(false)
  const [editing, setEditing] = useState<TherapyNote | null>(null)
  const [note, setNote] = useState('')
  const [shared, setShared] = useState(false)
  const [noteError, setNoteError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<TherapyNote | null>(null)
  const chartData = weekMetrics.daily.map((day) => ({ day: format(parseISO(`${day.date}T12:00:00`), 'EEE', { locale: ptBR }).slice(0, 3), completion: day.percentage }))

  const submitNote = async (event: FormEvent) => {
    event.preventDefault()
    if (!note.trim()) return
    setNoteError('')
    try {
      await saveTherapyNote({ id: editing?.id, date: editing?.date ?? today, weekStart: editing?.weekStart ?? weekStart, content: note, shared })
      setNote(''); setShared(false); setNoteOpen(false)
    } catch (cause) {
      setNoteError(cause instanceof Error ? cause.message : 'Não foi possível salvar a observação.')
    }
  }

  const exportSummary = () => {
    const sharedNotes = therapyNotes.filter((entry) => entry.shared && entry.date >= weekStart && entry.date <= today)
    const lines = ['LIFEOS · RESUMO SEMANAL', `${weekStart} a ${today}`, '', `Conclusão média: ${weekMetrics.averageCompletionPercent == null ? 'sem registro' : `${weekMetrics.averageCompletionPercent}%`}`, `Dias registrados: ${weekMetrics.recordedCompletionDays}`, `Sono médio: ${weekMetrics.averageSleepMinutes == null ? 'sem registro' : `${Math.floor(weekMetrics.averageSleepMinutes / 60)}h ${weekMetrics.averageSleepMinutes % 60}min`}`, `Energia média: ${averageEnergy ?? 'sem registro'}`, `Sobrecarga média: ${averageOverload ?? 'sem registro'}`, `Dias difíceis informados: ${weekCheckIns.length ? difficultDays : 'sem registro'}`, '', 'OBSERVAÇÕES AUTORIZADAS PARA EXPORTAÇÃO', ...sharedNotes.map((entry) => `${entry.date}: ${entry.content}`), ...(sharedNotes.length ? [] : ['Nenhuma observação marcada para compartilhar.']), '', 'Resumo descritivo dos registros pessoais. Não contém interpretação clínica.']
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `lifeos-resumo-${today}.txt`; anchor.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="page therapy-page">
      <PageHeading eyebrow="Acompanhamento" title="Painel de terapia" description="Um resumo construído automaticamente com os mesmos registros do seu dia a dia." actions={<><Button variant="secondary" onClick={exportSummary}><Download size={15} />Exportar resumo</Button><Button onClick={() => { setEditing(null); setNote(''); setNoteError(''); setShared(false); setNoteOpen(true) }}><Plus size={16} /><span className="hide-mobile">Nova observação</span></Button></>} />
      <Card className="privacy-banner" hidden={tab !== 'sharing'}><span><ShieldCheck size={22} /></span><div><strong>Você controla o compartilhamento</strong><p>Notas pessoais permanecem separadas. O resumo exportado inclui indicadores e apenas as notas marcadas para compartilhar. Para acompanhamento em tempo real, escolha a seleção e ative um link online.</p></div><Link className="button button--secondary button--sm" to="/sharing"><LockKeyhole size={13} />Compartilhar online</Link></Card>
      <PageTabs value={tab} onChange={setTab} label="Acompanhamento" items={[{id:'summary',label:'Resumo'},{id:'signals',label:'Como foi a semana'},{id:'notes',label:'Observações'},{id:'session',label:'Próxima sessão'},{id:'sharing',label:'Compartilhar'}]} />
      <div className="therapy-summary-grid" hidden={tab !== 'summary'}>
        <Card className="therapy-summary"><span className="therapy-summary__icon therapy-summary__icon--green"><Brain size={22} /></span><div><strong>{weekMetrics.averageCompletionPercent == null ? '—' : `${weekMetrics.averageCompletionPercent}%`}</strong><span>Conclusão da semana</span><small>{weekMetrics.recordedCompletionDays ? `${weekMetrics.recordedCompletionDays} dias registrados` : 'Sem registros'}</small></div></Card>
        <Card className="therapy-summary"><span className="therapy-summary__icon therapy-summary__icon--yellow">E</span><div><strong>{averageEnergy == null ? '—' : `${averageEnergy}/5`}</strong><span>Energia média</span><small>{weekCheckIns.length ? `${weekCheckIns.length} check-ins` : 'Sem check-ins'}</small></div></Card>
        <Card className="therapy-summary"><span className="therapy-summary__icon therapy-summary__icon--purple">S</span><div><strong>{averageOverload == null ? '—' : `${averageOverload}/5`}</strong><span>Sobrecarga média</span><small>{weekCheckIns.length ? 'Dado autorrelatado' : 'Sem check-ins'}</small></div></Card>
        <Card className="therapy-summary"><span className="therapy-summary__icon therapy-summary__icon--red">!</span><div><strong>{weekCheckIns.length ? difficultDays : '—'}</strong><span>Dias difíceis</span><small>{weekCheckIns.length ? 'Nesta semana' : 'Sem check-ins'}</small></div></Card>
      </div>
      <div className="therapy-content-grid">
        <Card className="therapy-chart-card" hidden={tab !== 'summary'}>
          <CardHeader eyebrow={`${format(weekStartDate, 'dd/MM')} – ${format(weekEndDate, 'dd/MM')}`} title="Conclusão diária" />
          {weekMetrics.recordedCompletionDays ? <div className="therapy-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid stroke="#202a2f" vertical={false} /><XAxis dataKey="day" tick={{ fill: '#84908d', fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis domain={[0,100]} tick={{ fill: '#84908d', fontSize: 9 }} axisLine={false} tickLine={false} width={27} /><Tooltip contentStyle={{ background: '#0d1417', border: '1px solid #283338', borderRadius: 8, fontSize: 10 }} formatter={(value) => [`${value}%`, 'Conclusão']} /><Bar dataKey="completion" fill="#70cf4d" radius={[5,5,1,1]} /></BarChart></ResponsiveContainer></div> : <EmptyState title="Resumo aguardando dados" description="Marque os hábitos na tela Hoje para formar o gráfico desta semana." />}
        </Card>
        <Card className="therapy-week-notes" hidden={tab !== 'signals'}>
          <CardHeader eyebrow="Autorrelato" title="Sinais da semana" />
          {weekCheckIns.length ? <div className="checkin-summary-list">{weekCheckIns.sort((a,b) => b.date.localeCompare(a.date)).map((check) => <div key={check.id}><time>{format(parseISO(`${check.date}T12:00:00`), 'EEE dd/MM', { locale: ptBR })}</time><span>Energia <b>{check.energy ?? '—'}</b></span><span>Sobrecarga <b>{check.overload ?? '—'}</b></span><span>Dificuldade <b>{check.difficulty ?? '—'}</b></span>{check.note && <p>{check.note}</p>}</div>)}</div> : <EmptyState title="Nenhum check-in na semana" description="Energia e sobrecarga podem ser registradas na tela Hoje." />}
        </Card>
        <Card className="next-therapy-card" hidden={tab !== 'session'}>
          <span className="next-therapy-card__icon"><CalendarClock size={25} /></span><span className="eyebrow">Próxima sessão</span>
          {nextSession ? <><strong>{format(nextSession, "EEEE, dd 'de' MMMM", { locale: ptBR })}</strong><p>{therapySchedule?.startTime}{therapySchedule?.endTime ? ` – ${therapySchedule.endTime}` : ''}</p><Badge tone="purple">{recurrenceLabel}</Badge></> : <><strong>Não configurada</strong><p>Adicione uma sessão nas configurações.</p></>}<Link className="button button--secondary button--sm" to={`/settings?tab=schedule${therapySchedule ? `&edit=${encodeURIComponent(therapySchedule.id)}` : ''}`}>Editar sessão</Link>
        </Card>
      </div>
      <Card className="therapy-notes-card" hidden={tab !== 'notes'}>
        <CardHeader eyebrow="Privado ou compartilhável" title="Observações" action={<span>{therapyNotes.length} notas</span>} />
        {therapyNotes.length ? <div className="therapy-notes-list">{therapyNotes.map((item) => <article key={item.id}><header><Badge tone={item.shared ? 'purple' : 'neutral'}>{item.shared ? <><Eye size={11} /> Compartilhável</> : <><EyeOff size={11} /> Pessoal</>}</Badge><time>{format(parseISO(`${item.date}T12:00:00`), 'dd/MM/yyyy')}</time><Button variant="ghost" size="icon" aria-label="Editar observação" onClick={() => { setEditing(item); setNote(item.content); setShared(item.shared); setNoteError(''); setNoteOpen(true) }}><Edit3 size={14} /></Button><Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)} aria-label={`Excluir observação de ${format(parseISO(`${item.date}T12:00:00`), 'dd/MM/yyyy')}`}><Trash2 size={14} /></Button></header><p>{item.content}</p></article>)}</div> : <EmptyState title="Nenhuma observação" description="Registre temas para a próxima conversa. Você decide se cada nota poderá ser compartilhada." />}
      </Card>
      <Modal open={noteOpen} title={editing ? 'Editar observação' : 'Nova observação'} description="A nota fica salva neste dispositivo e pode ser marcada como compartilhável." onClose={() => { setNoteOpen(false); setNoteError('') }} footer={<><Button variant="secondary" onClick={() => { setNoteOpen(false); setNoteError('') }}>Cancelar</Button><Button type="submit" form="therapy-note-form">Salvar nota</Button></>}>
        <form id="therapy-note-form" className="therapy-note-form" onSubmit={submitNote}><Field label="O que você quer lembrar?"><textarea value={note} onChange={(event) => { setNote(event.target.value); setNoteError('') }} placeholder="Como foi a semana, algo que pesou, um padrão percebido…" autoFocus required /></Field><label className="switch-row"><input type="checkbox" checked={shared} onChange={(event) => { setShared(event.target.checked); setNoteError('') }} /><span><strong>Pode ser compartilhada com a terapeuta</strong><small>Inclui esta nota ao exportar o resumo semanal.</small></span></label>{noteError && <p className="form-error" role="alert">{noteError}</p>}</form>
      </Modal>
      <Modal open={Boolean(deleteTarget)} title="Excluir observação?" description="A nota será removida deste dispositivo." onClose={() => setDeleteTarget(null)} footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button variant="danger" onClick={async () => { if (!deleteTarget) return; await removeTherapyNote(deleteTarget.id); setDeleteTarget(null) }}>Excluir definitivamente</Button></>}>
        <p className="modal-warning">Essa ação não pode ser desfeita sem restaurar um backup.</p>
      </Modal>
    </div>
  )
}

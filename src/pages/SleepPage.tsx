import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { differenceInMinutes, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlarmClock, MoonStar, Plus, Sparkles, Sunrise } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLifeOS } from '../app/LifeOSProvider'
import { PageTabs } from '../components/PageTabs'
import { PageHeading } from '../components/PageHeading'
import { Badge, Button, Card, CardHeader, EmptyState, Field } from '../components/ui'
import { getLastNDaysMetrics } from '../domain/metrics'
import { useCurrentDate } from '../hooks/useCurrentDate'
import { isDateKey } from '../domain/date'

function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function durationLabel(minutes?: number) {
  if (minutes == null || minutes < 0) return 'Em andamento'
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

export default function SleepPage() {
  const { habits, habitLogs, sleepLogs, waterLogs, settings, saveSleepLog } = useLifeOS()
  const currentDate = useCurrentDate(settings.timezone)
  const [params] = useSearchParams()
  const [tab, setTab] = useState('record')
  const queryDate = params.get('date')
  const [dateOverride, setDateOverride] = useState<string | null>(queryDate && isDateKey(queryDate) && queryDate <= currentDate ? queryDate : null)
  const date = dateOverride ?? currentDate
  const [startedAt, setStartedAt] = useState('')
  const [wokeAt, setWokeAt] = useState('')
  const [quality, setQuality] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const metrics = useMemo(() => getLastNDaysMetrics({ habits, habitLogs, sleepLogs, waterLogs, settings, endDate: currentDate, days: 30 }), [habits, habitLogs, sleepLogs, waterLogs, settings, currentDate])
  const chartData = useMemo(() => sleepLogs.filter((log) => log.wokeAt || log.durationMinutes != null).slice(0, 14).reverse().map((log) => {
    const minutes = log.durationMinutes ?? (log.wokeAt ? differenceInMinutes(parseISO(log.wokeAt), parseISO(log.sleepStartedAt)) : 0)
    return { date: format(parseISO(`${log.date}T12:00:00`), 'dd/MM'), hours: Math.round((minutes / 60) * 10) / 10, quality: log.quality }
  }), [sleepLogs])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!startedAt) { setError('Informe quando você dormiu.'); return }
    if (wokeAt && new Date(wokeAt) < new Date(startedAt)) { setError('O horário de acordar precisa vir depois do horário de dormir.'); return }
    setSaving(true)
    try {
      await saveSleepLog({ date, sleepStartedAt: new Date(startedAt).toISOString(), wokeAt: wokeAt ? new Date(wokeAt).toISOString() : undefined, quality: quality === '' ? undefined : quality as 1 | 2 | 3 | 4 | 5, note })
      setDateOverride(null); setStartedAt(''); setWokeAt(''); setQuality(''); setNote('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o registro de sono.')
    } finally { setSaving(false) }
  }

  const editLog = (index: number) => {
    setTab('record')
    const log = sleepLogs[index]
    setDateOverride(log.date === currentDate ? null : log.date)
    setStartedAt(localDateTimeValue(parseISO(log.sleepStartedAt)))
    setWokeAt(log.wokeAt ? localDateTimeValue(parseISO(log.wokeAt)) : '')
    setQuality(log.quality ?? '')
    setNote(log.note ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="page sleep-page">
      <PageHeading eyebrow="Registro diário" title="Sono" description="Informe os horários e a qualidade percebida para acompanhar o período." actions={<Badge tone="purple"><MoonStar size={12} /> Vinculado à rotina</Badge>} />
      <div className="sleep-kpis">
        <Card className="sleep-kpi"><MoonStar size={22} /><div><strong>{metrics.averageSleepMinutes == null ? '—' : durationLabel(metrics.averageSleepMinutes)}</strong><span>Média em 30 dias</span><small>{metrics.recordedSleepDays ? `${metrics.recordedSleepDays} noites registradas` : 'Sem dados ainda'}</small></div></Card>
        <Card className="sleep-kpi"><AlarmClock size={22} /><div><strong>{sleepLogs[0]?.sleepStartedAt ? format(parseISO(sleepLogs[0].sleepStartedAt), 'HH:mm') : '—'}</strong><span>Último horário de dormir</span><small>{sleepLogs[0] ? format(parseISO(`${sleepLogs[0].date}T12:00:00`), "dd 'de' MMM", { locale: ptBR }) : 'Sem dados ainda'}</small></div></Card>
        <Card className="sleep-kpi"><Sunrise size={22} /><div><strong>{sleepLogs[0]?.wokeAt ? format(parseISO(sleepLogs[0].wokeAt), 'HH:mm') : '—'}</strong><span>Último despertar</span><small>{sleepLogs[0]?.wokeAt ? 'Registrado' : 'Sem dados ainda'}</small></div></Card>
      </div>
      <PageTabs value={tab} onChange={setTab} label="Seções de sono" items={[{ id: 'record', label: 'Registrar uma noite' }, { id: 'duration', label: 'Duração' }, { id: 'history', label: 'Histórico' }]} />
      <div className="sleep-grid single-panel">
        <Card className="sleep-form-card" hidden={tab !== 'record'}>
          <CardHeader eyebrow="Novo registro" title="Registrar uma noite" action={<Plus size={17} />} />
          <form className="sleep-form" onSubmit={submit}>
            <Field label="Dia do registro"><input type="date" max={currentDate} value={date} onChange={(event) => setDateOverride(event.target.value === currentDate ? null : event.target.value)} required /></Field>
            <Field label="Quando dormiu"><input type="datetime-local" value={startedAt} onInput={(event) => setStartedAt(event.currentTarget.value)} required /></Field>
            <Field label="Quando acordou" hint="Pode deixar vazio se ainda estiver dormindo."><input type="datetime-local" value={wokeAt} onInput={(event) => setWokeAt(event.currentTarget.value)} /></Field>
            <Field label="Qualidade percebida">
              <select value={quality} onChange={(event) => setQuality(event.target.value ? Number(event.target.value) : '')}><option value="">Não informar</option><option value="1">1 · Muito ruim</option><option value="2">2 · Ruim</option><option value="3">3 · Regular</option><option value="4">4 · Boa</option><option value="5">5 · Muito boa</option></select>
            </Field>
            <Field label="Observação" className="sleep-form__wide"><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: despertei durante a noite ou acordei cansado" /></Field>
            {error && <p className="form-error sleep-form__wide">{error}</p>}
            <div className="sleep-form__actions sleep-form__wide"><small><Sparkles size={12} /> Salvar também conclui o hábito “Registrar horário do sono”.</small><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar noite'}</Button></div>
          </form>
        </Card>
        <Card className="sleep-chart-card" hidden={tab !== 'duration'}>
          <CardHeader eyebrow="Últimos registros" title="Duração do sono" />
          {chartData.length ? <div className="sleep-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid stroke="#202a2f" vertical={false} /><XAxis dataKey="date" tick={{ fill: '#7f8a87', fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 'auto']} tick={{ fill: '#7f8a87', fontSize: 9 }} axisLine={false} tickLine={false} width={24} /><Tooltip contentStyle={{ background: '#0d1417', border: '1px solid #283338', borderRadius: 8, fontSize: 10 }} formatter={(value) => [`${value}h`, 'Duração']} /><Bar dataKey="hours" fill="#9a65ef" radius={[5,5,1,1]} /></BarChart></ResponsiveContainer></div> : <EmptyState title="Nenhuma noite registrada" description="O gráfico será construído somente com os horários que você salvar." />}
        </Card>
      </div>
      <Card className="sleep-history" hidden={tab !== 'history'}>
        <CardHeader eyebrow="Histórico" title="Noites registradas" action={<span>{sleepLogs.length} registros</span>} />
        {sleepLogs.length ? <div className="sleep-history__list">{sleepLogs.map((log, index) => <button key={log.id} onClick={() => editLog(index)}><span className="sleep-history__date"><MoonStar size={15} /><strong>{format(parseISO(`${log.date}T12:00:00`), "dd 'de' MMMM", { locale: ptBR })}</strong></span><span><small>Dormiu</small><b>{format(parseISO(log.sleepStartedAt), 'HH:mm')}</b></span><span><small>Acordou</small><b>{log.wokeAt ? format(parseISO(log.wokeAt), 'HH:mm') : '—'}</b></span><span><small>Duração</small><b>{durationLabel(log.durationMinutes)}</b></span><span><small>Qualidade</small><b>{log.quality ? `${log.quality}/5` : '—'}</b></span></button>)}</div> : <EmptyState title="Histórico vazio" description="Suas noites salvas aparecerão aqui." />}
      </Card>
    </div>
  )
}

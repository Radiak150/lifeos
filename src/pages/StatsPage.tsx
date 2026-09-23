import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, Heart, MoonStar, Printer, Target } from 'lucide-react'
import { useLifeOS } from '../app/LifeOSProvider'
import { Heatmap } from '../components/Heatmap'
import { PageTabs } from '../components/PageTabs'
import { PageHeading } from '../components/PageHeading'
import { Button, Card, CardHeader, EmptyState, SegmentedControl } from '../components/ui'
import { getHeatmapData, getLastNDaysMetrics } from '../domain/metrics'
import { useCurrentDate } from '../hooks/useCurrentDate'

export default function StatsPage() {
  const { habits, habitLogs, sleepLogs, dayCheckIns, waterLogs, settings } = useLifeOS()
  const [tab, setTab] = useState('routine')
  const [range, setRange] = useState<'30' | '90'>('30')
  const days = Number(range)
  const endDate = useCurrentDate(settings.timezone)
  const metrics = useMemo(() => getLastNDaysMetrics({ habits, habitLogs, sleepLogs, waterLogs, endDate, days, settings }), [habits, habitLogs, sleepLogs, waterLogs, endDate, days, settings])
  const heatmap = useMemo(() => getHeatmapData(habits, habitLogs, endDate, settings, 90).map((day) => ({ date: day.date, classification: day.classification === 'no-data' ? 'none' as const : day.classification, percentage: day.percentage ?? undefined, completed: day.doneCount, planned: day.dueCount })), [habits, habitLogs, endDate, settings])
  const moodEntries = dayCheckIns.filter((entry) => entry.date >= metrics.startDate && entry.date <= metrics.endDate && entry.mood != null)
  const sleepByDate = new Map(sleepLogs
    .filter((entry) => entry.date >= metrics.startDate && entry.date <= metrics.endDate && entry.durationMinutes != null)
    .map((entry) => [entry.date, Math.round(((entry.durationMinutes ?? 0) / 60) * 10) / 10]))
  const moodByDate = new Map(moodEntries.map((entry) => [entry.date, entry.mood]))
  const chartData = metrics.daily.map((day) => ({
    date: format(parseISO(`${day.date}T12:00:00`), days > 30 ? 'dd/MM' : 'dd', { locale: ptBR }),
    completion: day.percentage,
    sleep: sleepByDate.get(day.date),
    mood: moodByDate.get(day.date)
  }))
  const averageMood = moodEntries.length
    ? Math.round((moodEntries.reduce((sum, entry) => sum + (entry.mood ?? 0), 0) / moodEntries.length) * 10) / 10
    : null
  const counts = {
    excellent: metrics.daily.filter((day) => day.classification === 'excellent').length,
    partial: metrics.daily.filter((day) => day.classification === 'partial').length,
    poor: metrics.daily.filter((day) => day.classification === 'poor').length
  }

  return (
    <div className="page stats-page">
      <PageHeading
        eyebrow="Resumo para consulta"
        title="Sua evolução"
        description="Uma visão simples dos registros feitos neste dispositivo."
        actions={
          <div className="page-heading-actions-row">
            <SegmentedControl value={range} options={[{ value: '30', label: '30 dias' }, { value: '90', label: '90 dias' }]} onChange={setRange} label="Período do histórico" />
            <Button variant="secondary" onClick={() => window.print()}><Printer size={15} /> Imprimir resumo</Button>
          </div>
        }
      />


      <div className="stats-kpis stats-kpis--simple">
        <Card><span className="stats-kpi__icon stats-kpi__icon--green"><Target size={22} /></span><div><strong>{metrics.averageCompletionPercent == null ? '—' : `${metrics.averageCompletionPercent}%`}</strong><span>Rotina realizada</span><small>{metrics.recordedCompletionDays} dias registrados</small></div></Card>
        <Card><span className="stats-kpi__icon stats-kpi__icon--purple"><MoonStar size={22} /></span><div><strong>{metrics.averageSleepMinutes == null ? '—' : `${Math.floor(metrics.averageSleepMinutes / 60)}h ${String(metrics.averageSleepMinutes % 60).padStart(2,'0')}m`}</strong><span>Sono médio</span><small>{metrics.recordedSleepDays} noites registradas</small></div></Card>
        <Card><span className="stats-kpi__icon stats-kpi__icon--blue"><Heart size={22} /></span><div><strong>{averageMood == null ? '—' : `${averageMood} / 5`}</strong><span>Estado emocional</span><small>{moodEntries.length} check-ins registrados</small></div></Card>
      </div>

      <PageTabs value={tab} onChange={setTab} label="Indicadores" items={[{id:'routine',label:'Rotina'},{id:'sleep',label:'Sono'},{id:'mood',label:'Como estou'},{id:'calendar',label:'Consistência'},{id:'legend',label:'Como ler'}]} />
      <div className="stats-main-grid">
        <Card className="stats-trend-card" hidden={tab !== 'routine'}>
          <CardHeader eyebrow={`${days} dias`} title="Rotina ao longo do tempo" />
          {metrics.recordedCompletionDays
            ? <div className="stats-trend-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="completionGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#70cf4d" stopOpacity=".35" /><stop offset="100%" stopColor="#70cf4d" stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="#202a2f" vertical={false} /><XAxis dataKey="date" tick={{ fill: '#7f8a87', fontSize: 8 }} axisLine={false} tickLine={false} interval="preserveStartEnd" /><YAxis domain={[0,100]} tick={{ fill: '#7f8a87', fontSize: 8 }} axisLine={false} tickLine={false} width={28} /><Tooltip contentStyle={{ background: '#0d1417', border: '1px solid #283338', borderRadius: 8, fontSize: 10 }} formatter={(value) => [`${value}%`, 'Rotina realizada']} /><Area type="monotone" dataKey="completion" stroke="#70cf4d" strokeWidth={2} fill="url(#completionGradient)" connectNulls={false} /></AreaChart></ResponsiveContainer></div>
            : <EmptyState title="Ainda não há histórico" description="O gráfico começa depois que a rotina é registrada. Dias vazios não viram zero." />}
        </Card>

        <Card className="classification-card" hidden={tab !== 'legend'}>
          <CardHeader eyebrow="Legenda" title="Como ler os dias" action={<BarChart3 size={17} />} />
          <div className="classification-list">
            <span><i className="legend-dot--excellent" /><div><strong>Concluído</strong><small>{settings.completion.excellentAt}% ou mais</small></div><b>{counts.excellent}</b></span>
            <span><i className="legend-dot--partial" /><div><strong>Parcial</strong><small>{settings.completion.partialAt}% a {settings.completion.excellentAt - 1}%</small></div><b>{counts.partial}</b></span>
            <span><i className="legend-dot--poor" /><div><strong>Dia difícil</strong><small>abaixo de {settings.completion.partialAt}%</small></div><b>{counts.poor}</b></span>
            <span><i className="legend-dot--none" /><div><strong>Sem registro</strong><small>não entra na média</small></div><b>{days - metrics.recordedCompletionDays}</b></span>
          </div>
        </Card>
      </div>

      <div className="stats-signal-grid">
        <Card hidden={tab !== 'sleep'}>
          <CardHeader eyebrow={`${days} dias`} title="Duração do sono" />
          {metrics.recordedSleepDays
            ? <div className="stats-mini-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="sleepHistoryGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9a65ef" stopOpacity=".3" /><stop offset="100%" stopColor="#9a65ef" stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="#202a2f" vertical={false} /><XAxis dataKey="date" tick={{ fill: '#7f8a87', fontSize: 8 }} axisLine={false} tickLine={false} interval="preserveStartEnd" /><YAxis domain={[0, 'auto']} tick={{ fill: '#7f8a87', fontSize: 8 }} axisLine={false} tickLine={false} width={28} unit="h" /><Tooltip contentStyle={{ background: '#0d1417', border: '1px solid #283338', borderRadius: 8, fontSize: 10 }} formatter={(value) => [`${value}h`, 'Sono']} /><Area type="monotone" dataKey="sleep" stroke="#9a65ef" strokeWidth={2} fill="url(#sleepHistoryGradient)" connectNulls={false} /></AreaChart></ResponsiveContainer></div>
            : <EmptyState title="Sono ainda sem dados" description="O gráfico será criado quando houver horários completos salvos." />}
        </Card>
        <Card hidden={tab !== 'mood'}>
          <CardHeader eyebrow={`${days} dias`} title="Estado emocional informado" />
          {moodEntries.length
            ? <div className="stats-mini-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="moodHistoryGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4d92f3" stopOpacity=".28" /><stop offset="100%" stopColor="#4d92f3" stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="#202a2f" vertical={false} /><XAxis dataKey="date" tick={{ fill: '#7f8a87', fontSize: 8 }} axisLine={false} tickLine={false} interval="preserveStartEnd" /><YAxis domain={[1, 5]} ticks={[1,2,3,4,5]} tick={{ fill: '#7f8a87', fontSize: 8 }} axisLine={false} tickLine={false} width={22} /><Tooltip contentStyle={{ background: '#0d1417', border: '1px solid #283338', borderRadius: 8, fontSize: 10 }} formatter={(value) => [`${value}/5`, 'Estado emocional']} /><Area type="monotone" dataKey="mood" stroke="#4d92f3" strokeWidth={2} fill="url(#moodHistoryGradient)" connectNulls={false} /></AreaChart></ResponsiveContainer></div>
            : <EmptyState title="Estado emocional ainda sem dados" description="O gráfico será criado após os registros feitos na tela Hoje." />}
        </Card>
      </div>

      <Card className="stats-heatmap-card" hidden={tab !== 'calendar'}>
        <CardHeader eyebrow="Visão contínua" title="Calendário dos últimos 90 dias" />
        <div className="stats-heatmap-body"><Heatmap points={heatmap} />{metrics.recordedCompletionDays === 0 && <p>As células ganham cor somente quando existe registro.</p>}</div>
      </Card>

      <p className="stats-disclaimer">Este resumo organiza informações registradas pela própria pessoa. Ele não faz diagnóstico e não substitui avaliação profissional.</p>
    </div>
  )
}

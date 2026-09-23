import { useCallback, useMemo, useState } from 'react'
import { differenceInMinutes, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Droplets,
  Gauge,
  MoonStar,
  NotebookPen
} from 'lucide-react'
import { useLifeOS } from '../app/LifeOSProvider'
import { MonthCalendar, type DayVisualState } from '../components/MonthCalendar'
import { PageTabs } from '../components/PageTabs'
import { PageHeading } from '../components/PageHeading'
import { Badge, Card, CardHeader, CompletionIcon, EmptyState, ProgressRing } from '../components/ui'
import { fromDateKey, toDateKey } from '../domain/date'
import { getDailyCompletion, getDueHabits } from '../domain/metrics'
import { getScheduleForDate } from '../domain/schedule'
import type { HabitLog, HabitLogStatus, SleepLog } from '../domain/types'
import { useCurrentDate } from '../hooks/useCurrentDate'
import { getIcon } from '../lib/presentation'

const logStatusLabels: Record<HabitLogStatus, string> = {
  done: 'Feito',
  partial: 'Parcial',
  missed: 'Não feito',
  skipped: 'Ignorado'
}

function completionTone(percentage: number | null, excellentAt: number, partialAt: number) {
  if (percentage == null) return 'neutral' as const
  if (percentage >= excellentAt) return 'success' as const
  if (percentage >= partialAt) return 'warning' as const
  return 'danger' as const
}

function sleepDuration(log?: SleepLog) {
  if (!log) return null
  if (log.durationMinutes != null) return log.durationMinutes
  if (!log.wokeAt) return null
  const minutes = differenceInMinutes(parseISO(log.wokeAt), parseISO(log.sleepStartedAt))
  return minutes >= 0 ? minutes : null
}

function formatDuration(minutes: number | null) {
  if (minutes == null) return 'Sem registro completo'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours}h ${String(rest).padStart(2, '0')}min`
}

function ratingLabel(value?: number) {
  return value == null ? 'Não informado' : `${value} de 5`
}

export default function CalendarPage() {
  const [tab, setTab] = useState('calendar')
  const {
    habits,
    habitLogs,
    sleepLogs,
    dayCheckIns,
    waterLogs,
    scheduleItems,
    settings
  } = useLifeOS()
  const todayKey = useCurrentDate(settings.timezone)
  const [monthOverride, setMonthOverride] = useState<string | null>(null)
  const [selectedDateOverride, setSelectedDateOverride] = useState<string | null>(null)
  const selectedKey = selectedDateOverride ?? todayKey
  const selectedDate = fromDateKey(selectedKey)
  const month = fromDateKey(monthOverride ?? selectedKey)

  const completion = useMemo(
    () => getDailyCompletion(habits, habitLogs, selectedKey, settings),
    [habits, habitLogs, selectedKey, settings]
  )
  const dueHabits = useMemo(() => getDueHabits(habits, selectedKey), [habits, selectedKey])
  const dayHabitLogs = useMemo(
    () => habitLogs.filter((log) => log.date === selectedKey),
    [habitLogs, selectedKey]
  )
  const logsByHabit = useMemo(
    () => new Map<string, HabitLog>(dayHabitLogs.map((log) => [log.habitId, log])),
    [dayHabitLogs]
  )
  const agenda = useMemo(
    () => getScheduleForDate(scheduleItems, selectedDate),
    [scheduleItems, selectedDate]
  )
  const checkIn = useMemo(
    () => dayCheckIns.find((entry) => entry.date === selectedKey),
    [dayCheckIns, selectedKey]
  )
  const waterEntries = useMemo(
    () => waterLogs
      .filter((entry) => entry.date === selectedKey)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
    [waterLogs, selectedKey]
  )
  const waterTotal = useMemo(
    () => waterEntries.reduce((total, entry) => total + entry.amountMl, 0),
    [waterEntries]
  )
  const sleepLog = useMemo(
    () => sleepLogs.find((entry) => entry.date === selectedKey),
    [sleepLogs, selectedKey]
  )
  const sleepMinutes = sleepDuration(sleepLog)

  const getDayState = useCallback((date: Date): DayVisualState => {
    const dateKey = toDateKey(date)
    const dayCompletion = getDailyCompletion(habits, habitLogs, dateKey, settings)
    return {
      classification: dayCompletion.classification === 'no-data' ? 'none' : dayCompletion.classification,
      percentage: dayCompletion.percentage ?? undefined,
      planned: dayCompletion.dueCount,
      completed: dayCompletion.doneCount,
      hasTherapy: scheduleItems.some(
        (item) => item.category === 'therapy' && getScheduleForDate([item], date).length > 0
      )
    }
  }, [habits, habitLogs, scheduleItems, settings])

  const selectDate = (date: Date) => {
    setTab('summary')
    const key = toDateKey(date)
    setSelectedDateOverride(key === todayKey ? null : key)
    setMonthOverride(key === todayKey ? null : key)
  }

  const changeMonth = (date: Date) => {
    const key = toDateKey(date)
    setMonthOverride(key === todayKey ? null : key)
    setSelectedDateOverride(key === todayKey ? null : key)
  }

  const selectedDateLabel = format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })

  return (
    <div className="page calendar-page">
      <PageHeading
        eyebrow="Histórico real"
        title="Calendário"
        description="Navegue pelos dias para entender o que foi planejado, registrado e sentido."
        actions={
          <Badge tone={completionTone(completion.percentage, settings.completion.excellentAt, settings.completion.partialAt)}>
            <Gauge size={13} />
            {completion.percentage == null ? 'Sem conclusão registrada' : `${completion.percentage}% concluído`}
          </Badge>
        }
      />

      <PageTabs value={tab} onChange={setTab} label="Agenda e registros" items={[{id:'calendar',label:'Calendário'},{id:'summary',label:'Dia selecionado'},{id:'habits',label:'Hábitos'},{id:'records',label:'Registros'},{id:'agenda',label:'Compromissos'},{id:'checkin',label:'Como estava'}]} />
      {tab !== 'calendar' && <p className="selected-date-label">{selectedDateLabel}</p>}
      <div className="calendar-page__layout">
        <Card className="calendar-page__calendar" hidden={tab !== 'calendar'}>
          <MonthCalendar
            month={month}
            selectedDate={selectedDate}
            today={fromDateKey(todayKey)}
            weekStartsOn={settings.weekStartsOn}
            onMonthChange={changeMonth}
            onSelectDate={selectDate}
            getDayState={getDayState}
            thresholds={settings.completion}
          />
        </Card>

        <aside className="calendar-page__details" aria-label={`Detalhes de ${selectedDateLabel}`}>
          <Card className="calendar-day-summary" hidden={tab !== 'summary'}>
            <CardHeader
              eyebrow="Dia selecionado"
              title={selectedDateLabel}
              action={
                <ProgressRing
                  value={completion.percentage ?? 0}
                  size={72}
                  color={completion.percentage == null ? 'var(--muted)' : 'var(--green)'}
                />
              }
            />
            <div className="calendar-day-summary__metrics">
              <div className="calendar-day-metric">
                <CheckCircle2 size={17} />
                <span>Hábitos registrados</span>
                <strong>{completion.recordedCount}/{completion.dueCount}</strong>
              </div>
              <div className="calendar-day-metric">
                <Droplets size={17} />
                <span>Água</span>
                <strong>{waterEntries.length ? `${waterTotal} ml` : 'Sem registro'}</strong>
              </div>
              <div className="calendar-day-metric">
                <MoonStar size={17} />
                <span>Sono</span>
                <strong>{formatDuration(sleepMinutes)}</strong>
              </div>
            </div>
          </Card>

          <Card className="calendar-day-habits" hidden={tab !== 'habits'}>
            <CardHeader
              eyebrow="Planejado para o dia"
              title="Hábitos e registros"
              action={<Badge tone="neutral">{dayHabitLogs.length} gravados</Badge>}
            />
            {dueHabits.length === 0 ? (
              <EmptyState
                title="Nenhum hábito planejado"
                description="Este dia não possui hábitos ativos previstos pela frequência configurada."
              />
            ) : (
              <div className="calendar-habit-list">
                {dueHabits.map((habit) => {
                  const log = logsByHabit.get(habit.id)
                  const Icon = getIcon(habit.icon)
                  return (
                    <article
                      className={`calendar-habit-record calendar-habit-record--${log?.status ?? 'pending'}`}
                      key={habit.id}
                    >
                      <span className={`calendar-habit-record__icon calendar-habit-record__icon--${habit.category}`}>
                        <Icon width={18} height={18} />
                      </span>
                      <div className="calendar-habit-record__copy">
                        <strong>{habit.name}</strong>
                        <small>{habit.minimumVersion}</small>
                      </div>
                      <div className="calendar-habit-record__status">
                        <CompletionIcon state={log?.status} />
                        <span>{log ? logStatusLabels[log.status] : 'Pendente'}</span>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </Card>

          <Card className="calendar-day-records" hidden={tab !== 'records'}>
            <CardHeader eyebrow="Persistido no dispositivo" title="Registros do dia" />
            {dayHabitLogs.length === 0 && waterEntries.length === 0 && !sleepLog ? (
              <EmptyState
                title="Nenhum registro gravado"
                description="Quando você registrar hábitos, água ou sono, os dados aparecerão aqui."
                icon="database"
              />
            ) : (
              <div className="calendar-record-list">
                {dayHabitLogs.length > 0 && (
                  <div className="calendar-record-item">
                    <CheckCircle2 size={17} />
                    <div><strong>{dayHabitLogs.length} registro(s) de hábito</strong><small>{completion.doneCount} feito(s), {completion.partialCount} parcial(is), {completion.missedCount} não feito(s)</small></div>
                  </div>
                )}
                {waterEntries.length > 0 && (
                  <div className="calendar-record-item">
                    <Droplets size={17} />
                    <div><strong>{waterTotal} ml de água</strong><small>{waterEntries.length} registro(s) gravado(s)</small></div>
                  </div>
                )}
                {sleepLog && (
                  <div className="calendar-record-item">
                    <MoonStar size={17} />
                    <div><strong>{formatDuration(sleepMinutes)} de sono</strong><small>Início registrado às {format(parseISO(sleepLog.sleepStartedAt), 'HH:mm')}</small></div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="calendar-day-agenda" hidden={tab !== 'agenda'}>
            <CardHeader
              eyebrow="Blocos recorrentes e pontuais"
              title="Agenda"
              action={<CalendarClock size={18} />}
            />
            {agenda.length === 0 ? (
              <EmptyState title="Agenda livre" description="Nenhum compromisso está configurado para este dia." />
            ) : (
              <div className="timeline-list calendar-timeline">
                {agenda.map((item) => {
                  const Icon = getIcon(item.category === 'fushi' ? 'fushi' : item.category === 'work' ? 'briefcase' : item.category === 'therapy' ? 'notebook' : 'general')
                  return (
                    <div className={`timeline-item timeline-item--${item.color ?? item.category}`} key={item.id}>
                      <time>{item.startTime}</time>
                      <span className="timeline-item__dot" />
                      <span className="timeline-item__icon"><Icon width={15} height={15} /></span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>
                          {[item.endTime ? `até ${item.endTime}` : null, item.location, item.protectedTime ? 'tempo protegido' : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card className="calendar-day-checkin" hidden={tab !== 'checkin'}>
            <CardHeader eyebrow="Como o dia foi sentido" title="Check-in" action={<NotebookPen size={18} />} />
            {!checkIn ? (
              <EmptyState
                title="Sem check-in neste dia"
                description="Nenhum dado de energia, sobrecarga ou humor foi registrado."
              />
            ) : (
              <div className="calendar-checkin-grid">
                <div><span>Energia</span><strong>{ratingLabel(checkIn.energy)}</strong></div>
                <div><span>Sobrecarga</span><strong>{ratingLabel(checkIn.overload)}</strong></div>
                <div><span>Dificuldade</span><strong>{ratingLabel(checkIn.difficulty)}</strong></div>
                <div><span>Humor</span><strong>{ratingLabel(checkIn.mood)}</strong></div>
                {checkIn.note && <p className="calendar-checkin-note">“{checkIn.note}”</p>}
                <small className="calendar-checkin-updated">
                  <Clock3 size={13} /> Atualizado em {format(parseISO(checkIn.updatedAt), "dd/MM 'às' HH:mm")}
                </small>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  )
}

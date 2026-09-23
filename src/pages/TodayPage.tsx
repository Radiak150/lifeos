import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageTabs } from '../components/PageTabs'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CalendarClock,
  Check,
  Circle,
  Gauge,
  Droplets,
  Heart,
  Minus,
  Save,
  Undo2,
  X,
  type LucideIcon
} from 'lucide-react'
import { useLifeOS } from '../app/LifeOSProvider'
import { PageHeading } from '../components/PageHeading'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CompletionIcon,
  EmptyState,
  Field,
  ProgressBar,
  ProgressRing
} from '../components/ui'
import { DEFAULT_IDS } from '../data/defaults'
import { fromDateKey } from '../domain/date'
import { getDailyCompletion, getDueHabits } from '../domain/metrics'
import { getScheduleForDate } from '../domain/schedule'
import type { HabitLogStatus } from '../domain/types'
import { useCurrentDate } from '../hooks/useCurrentDate'
import { getIcon } from '../lib/presentation'

type FocusStatus = 'pending' | Extract<HabitLogStatus, 'done' | 'partial' | 'missed'>
type Rating = 1 | 2 | 3 | 4 | 5

const focusStatuses: Array<{ value: FocusStatus; label: string; icon: LucideIcon }> = [
  { value: 'done', label: 'Feito', icon: Check },
  { value: 'partial', label: 'Parcial', icon: Minus },
  { value: 'missed', label: 'Não feito', icon: X },
  { value: 'pending', label: 'Pendente', icon: Circle }
]

function RatingScale({
  label,
  value,
  onChange,
  lowLabel,
  highLabel
}: {
  label: string
  value?: Rating
  onChange: (value: Rating) => void
  lowLabel: string
  highLabel: string
}) {
  const options: Rating[] = [1, 2, 3, 4, 5]
  const onOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, option: Rating) => {
    const currentIndex = options.indexOf(option)
    let nextIndex: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') nextIndex = Math.min(options.length - 1, currentIndex + 1)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') nextIndex = Math.max(0, currentIndex - 1)
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = options.length - 1
    else return

    event.preventDefault()
    const nextValue = options[nextIndex]
    onChange(nextValue)
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    buttons?.[nextIndex]?.focus()
  }

  return (
    <fieldset className="today-rating">
      <legend>{label}</legend>
      <div className="today-rating__scale" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`today-rating__option${value === option ? ' today-rating__option--active' : ''}`}
            role="radio"
            aria-checked={value === option}
            aria-label={`${label}: ${option} de 5`}
            tabIndex={value === option || (value == null && option === 1) ? 0 : -1}
            onClick={() => onChange(option)}
            onKeyDown={(event) => onOptionKeyDown(event, option)}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="today-rating__labels"><small>{lowLabel}</small><small>{highLabel}</small></div>
    </fieldset>
  )
}

import { useCategories } from '../hooks/useCategories'

export default function TodayPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? (window.location.hash === '#water' ? 'water' : 'activities')
  const setTab = (value: string) => setParams({ tab: value }, { replace: true })
  const { icons: categoryIcons } = useCategories()
  const {
    habits,
    habitLogs,
    dayCheckIns,
    waterLogs,
    scheduleItems,
    settings,
    setHabitLog,
    saveDayCheckIn,
    addWater,
    removeWaterLog
  } = useLifeOS()
  const todayKeyValue = useCurrentDate(settings.timezone)
  const today = fromDateKey(todayKeyValue)
  const focusHabits = getDueHabits(habits, todayKeyValue)
  const todayLogs = new Map(habitLogs.filter((log) => log.date === todayKeyValue).map((log) => [log.habitId, log]))
  const completion = getDailyCompletion(habits, habitLogs, todayKeyValue, settings)
  const timeline = getScheduleForDate(scheduleItems, today)
  const currentCheckIn = dayCheckIns.find((entry) => entry.date === todayKeyValue)
  const todayWater = waterLogs.filter((entry) => entry.date === todayKeyValue)
  const waterTotal = todayWater.reduce((sum, entry) => sum + entry.amountMl, 0)
  const latestWater = [...todayWater].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0]

  const [savingHabitId, setSavingHabitId] = useState<string | null>(null)
  const [habitError, setHabitError] = useState<string | null>(null)
  const [moodDraft, setMoodDraft] = useState<Rating | undefined>()
  const [energyDraft, setEnergyDraft] = useState<Rating | undefined>()
  const [overloadDraft, setOverloadDraft] = useState<Rating | undefined>()
  const [difficultyDraft, setDifficultyDraft] = useState<Rating | undefined>()
  const [noteDraft, setNoteDraft] = useState<string | null>(null)
  const [checkInState, setCheckInState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [checkInMessage, setCheckInMessage] = useState('')
  const [waterAmount, setWaterAmount] = useState('200')
  const [savingWater, setSavingWater] = useState(false)
  const [waterMessage, setWaterMessage] = useState('')
  const mood = moodDraft ?? currentCheckIn?.mood
  const energy = energyDraft ?? currentCheckIn?.energy
  const overload = overloadDraft ?? currentCheckIn?.overload
  const difficulty = difficultyDraft ?? currentCheckIn?.difficulty
  const note = noteDraft ?? currentCheckIn?.note ?? ''

  const setFocusStatus = async (habitId: string, status: FocusStatus) => {
    setSavingHabitId(habitId)
    setHabitError(null)
    try {
      await setHabitLog(habitId, todayKeyValue, status === 'pending' ? null : status)
    } catch (cause) {
      setHabitError(cause instanceof Error ? cause.message : 'Não foi possível salvar o estado do hábito.')
    } finally {
      setSavingHabitId(null)
    }
  }

  const submitCheckIn = async () => {
    if (!mood && !energy && !overload && !difficulty && !note.trim()) {
      setCheckInState('error')
      setCheckInMessage('Informe pelo menos uma avaliação ou uma observação.')
      return
    }
    setCheckInState('saving')
    setCheckInMessage('')
    try {
      await saveDayCheckIn({
        date: todayKeyValue,
        energy,
        overload,
        difficulty,
        mood,
        difficultDay: currentCheckIn?.difficultDay,
        note: note.trim() || undefined
      })
      setCheckInState('saved')
      setCheckInMessage('Registro salvo no histórico de hoje.')
    } catch (cause) {
      setCheckInState('error')
      setCheckInMessage(cause instanceof Error ? cause.message : 'Não foi possível salvar o check-in.')
    }
  }

  const recordWater = async (amountMl: number) => {
    if (savingWater) return
    setSavingWater(true)
    setWaterMessage('')
    try {
      await addWater(todayKeyValue, amountMl)
      setWaterMessage(`${amountMl} ml registrados.`)
    } catch (cause) {
      setWaterMessage(cause instanceof Error ? cause.message : 'Não foi possível salvar a água.')
    } finally { setSavingWater(false) }
  }

  const submitWater = (event: FormEvent) => {
    event.preventDefault()
    void recordWater(Number(waterAmount))
  }

  const nextPendingHabit = focusHabits.find((habit) => todayLogs.get(habit.id)?.status !== 'done')

  return (
    <div className="page today-page">
      <PageHeading
        eyebrow={`Planejamento do dia · ${format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}`}
        title="Meu dia"
        description="Escolha o que quer registrar agora."
        actions={
          <Badge tone={completion.percentage == null ? 'neutral' : completion.percentage >= settings.completion.excellentAt ? 'success' : 'warning'}>
            <Gauge size={13} /> {completion.percentage == null ? 'Dia ainda sem registros' : `${completion.percentage}% concluído`}
          </Badge>
        }
      />

      <PageTabs value={tab} onChange={setTab} label="Registros do dia" items={[{ id: 'activities', label: 'Atividades' }, { id: 'water', label: 'Água' }, { id: 'mood', label: 'Como estou' }, { id: 'agenda', label: 'Agenda' }]} />
      <Card className="today-next-action" hidden={tab !== 'activities'}>
        <div className="today-next-action__copy">
          <span className="eyebrow">Próxima atividade</span>
          <strong>{nextPendingHabit?.minimumVersion ?? (focusHabits.length ? 'Os focos de hoje estão concluídos.' : 'Nenhum hábito ativo está previsto para hoje.')}</strong>
          {nextPendingHabit && <small>{nextPendingHabit.name}</small>}
        </div>
        <ProgressRing
          value={completion.percentage ?? 0}
          size={78}
          color={completion.percentage == null ? 'var(--muted)' : 'var(--green)'}
        />
      </Card>

      <div className="today-page__layout">
        <section className="today-page__primary" aria-label="Ações principais de hoje">
          <Card className="today-focus-card" hidden={tab !== 'activities'}>
            <CardHeader
              eyebrow="Rotina programada"
              title="Atividades de hoje"
              action={<Badge tone="success">{focusHabits.length} {focusHabits.length === 1 ? 'item' : 'itens'}</Badge>}
            />
            {focusHabits.length === 0 ? (
              <EmptyState
                title="Nenhum foco previsto"
                description="Ative ou programe hábitos na tela Hábitos para organizar as próximas atividades."
                action={<Link className="button button--secondary button--sm" to="/habits">Organizar hábitos</Link>}
              />
            ) : (
              <div className="today-focus-list">
                {focusHabits.map((habit, index) => {
                  const log = todayLogs.get(habit.id)
                  const currentStatus: FocusStatus = log?.status === 'skipped' ? 'pending' : log?.status ?? 'pending'
                  const Icon = getIcon(habit.icon)
                  const sleepBacked = habit.id === DEFAULT_IDS.habit.registerSleep
                  const waterBacked = habit.id === DEFAULT_IDS.habit.water
                  return (
                    <article className={`today-focus-habit today-focus-habit--${currentStatus}`} key={habit.id}>
                      <div className="today-focus-habit__heading">
                        <span className={`today-focus-habit__icon today-focus-habit__icon--${habit.category}`}>
                          <Icon width={23} height={23} />
                        </span>
                        <div>
                          <small>Atividade {index + 1}</small>
                          <strong>{habit.name}</strong>
                          <p>{habit.objective}</p>
                        </div>
                        <CompletionIcon state={log?.status} />
                      </div>
                      <div className="today-focus-habit__minimum">
                        <span>Opção reduzida</span>
                        <strong>{habit.minimumVersion}</strong>
                      </div>
                      <div className="habit-status-selector" role="group" aria-label={`Estado de ${habit.name}`}>
                        {focusStatuses.map(({ value, label, icon: StatusIcon }) => (
                          <Button
                            key={value}
                            variant="secondary"
                            size="sm"
                            className={`habit-status-option habit-status-option--${value}${currentStatus === value ? ' habit-status-option--active' : ''}`}
                            aria-pressed={currentStatus === value}
                            disabled={savingHabitId === habit.id || sleepBacked || waterBacked}
                            title={sleepBacked ? 'Este hábito é atualizado automaticamente ao salvar a noite na tela Sono.' : undefined}
                            onClick={() => void setFocusStatus(habit.id, value)}
                          >
                            <StatusIcon size={14} /> {label}
                          </Button>
                        ))}
                      </div>
                      {waterBacked && <Button variant="secondary" onClick={() => setTab('water')}>Registrar água</Button>}
                      {sleepBacked && <Link className="button button--secondary button--sm today-focus-habit__source" to="/sleep">Registrar a noite</Link>}
                    </article>
                  )
                })}
              </div>
            )}
            {habitError && <p className="today-feedback today-feedback--error" role="alert">{habitError}</p>}
          </Card>

          <Card className="today-timeline-card" hidden={tab !== 'agenda'}>
            <CardHeader eyebrow="Agenda" title="Linha do tempo de hoje" action={<Link className="button button--ghost button--sm" to="/settings?tab=schedule"><CalendarClock size={16} />Editar</Link>} />
            {timeline.length === 0 ? (
              <EmptyState
                title="Agenda livre"
                description="Nenhum bloco recorrente ou pontual está configurado para hoje."
              />
            ) : (
              <div className="timeline-list today-timeline">
                {timeline.map((item) => {
                  const Icon = getIcon(categoryIcons[item.category])
                  return (
                    <div className={`timeline-item timeline-item--${item.color ?? item.category}`} key={item.id}>
                      <time>{item.startTime}{item.dayOffset === 1 && <small> +1 dia</small>}</time>
                      <span className="timeline-item__dot" />
                      <span className="timeline-item__icon"><Icon width={15} height={15} /></span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>
                          {[item.endTime ? `até ${item.endTime}` : null, item.location, item.protectedTime ? 'tempo protegido' : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                        {item.note && <small>{item.note}</small>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </section>

        <aside className="today-page__sidebar" aria-label="Registro do estado emocional">
          <Card className="today-water-card" id="water" hidden={tab !== 'water'}>
            <CardHeader eyebrow="Hidratação" title="Água de hoje" action={<Droplets size={19} />} />
            <div className="today-water-total"><strong>{waterTotal} ml</strong><span>Meta pessoal: {settings.waterGoalMl} ml</span></div>
            <ProgressBar value={waterTotal / settings.waterGoalMl * 100} tone="blue" label={`${waterTotal} de ${settings.waterGoalMl} ml registrados hoje`} />
            <div className="today-water-presets">{[100, 200, 300].map((amount) => <Button key={amount} size="sm" variant="secondary" disabled={savingWater} onClick={() => void recordWater(amount)}>+ {amount} ml</Button>)}</div>
            <form className="today-water-form" onSubmit={submitWater}><Field label="Outra quantidade (ml)"><input type="number" min="1" max="5000" step="1" required value={waterAmount} onChange={(event) => setWaterAmount(event.target.value)} /></Field><Button type="submit" size="sm" disabled={savingWater}>Registrar</Button></form>
            {latestWater && <Button className="today-water-undo" variant="ghost" size="sm" disabled={savingWater} onClick={async () => { setSavingWater(true); try { await removeWaterLog(latestWater.id); setWaterMessage(`Registro de ${latestWater.amountMl} ml removido.`) } catch { setWaterMessage('Não foi possível desfazer o registro.') } finally { setSavingWater(false) } }}><Undo2 size={13} />Desfazer últimos {latestWater.amountMl} ml</Button>}
            <p className="today-feedback" role="status">{waterMessage || 'Registre a quantidade que você bebeu.'}</p>
            <Link className="button button--ghost button--sm" to="/settings?tab=system">Ajustar meta</Link>
          </Card>
          <Card className="today-checkin-card" hidden={tab !== 'mood'}>
            <CardHeader eyebrow="Registro rápido" title="Como foi seu dia?" action={<Heart size={18} />} />
            <div className="today-checkin-form">
              <RatingScale
                label="Estado emocional"
                value={mood}
                onChange={(value) => { setMoodDraft(value); setCheckInState('idle'); setCheckInMessage('') }}
                lowLabel="muito difícil"
                highLabel="muito bom"
              />
              <details className="today-checkin-details"><summary>Energia, sobrecarga e dificuldade</summary>
                <RatingScale label="Energia" value={energy} onChange={(value) => { setEnergyDraft(value); setCheckInState('idle') }} lowLabel="baixa" highLabel="alta" />
                <RatingScale label="Sobrecarga" value={overload} onChange={(value) => { setOverloadDraft(value); setCheckInState('idle') }} lowLabel="baixa" highLabel="alta" />
                <RatingScale label="Dificuldade para seguir a rotina" value={difficulty} onChange={(value) => { setDifficultyDraft(value); setCheckInState('idle') }} lowLabel="baixa" highLabel="alta" />
              </details>
              <Field label="Observação opcional" hint="Uma frase curta já é suficiente.">
                <textarea
                  value={note}
                  maxLength={280}
                  onChange={(event) => { setNoteDraft(event.target.value); setCheckInState('idle'); setCheckInMessage('') }}
                  placeholder="O que mais marcou o dia?"
                />
              </Field>
              <Button disabled={checkInState === 'saving'} onClick={() => void submitCheckIn()}>
                <Save size={15} /> {checkInState === 'saving' ? 'Salvando…' : 'Salvar no histórico'}
              </Button>
              <p
                className={`today-feedback${checkInState === 'error' ? ' today-feedback--error' : checkInState === 'saved' ? ' today-feedback--success' : ''}`}
                aria-live="polite"
              >
                {checkInMessage || (currentCheckIn ? 'O dia já foi registrado e pode ser atualizado.' : 'Escolha um valor de 1 a 5.')}
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}

import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Edit3, Flame, ListChecks, Plus, Trash2 } from 'lucide-react'
import { useLifeOS } from '../app/LifeOSProvider'
import { PageHeading } from '../components/PageHeading'
import { Badge, Button, Card, EmptyState, Field, Modal, ProgressBar, SegmentedControl } from '../components/ui'
import { calculateHabitStreak } from '../domain/metrics'
import type { Habit, HabitFrequency, HabitStatus, LifeArea, Weekday } from '../domain/types'
import { useCurrentDate } from '../hooks/useCurrentDate'
import { getIcon, habitStatusLabels, toneForHabitStatus } from '../lib/presentation'

import { useCategories } from '../hooks/useCategories'

type HabitForm = {
  id?: string
  name: string
  category: LifeArea
  objective: string
  minimumVersion: string
  frequencyType: HabitFrequency['type']
  weekdays: number[]
  weeklyTarget: number
  intervalEveryDays: number
  intervalAnchorDate: string
  status: HabitStatus
  icon: string
  xpReward: number
}

const emptyForm = (): HabitForm => ({
  name: '',
  category: 'health',
  objective: '',
  minimumVersion: '',
  frequencyType: 'daily',
  weekdays: [1, 2, 3, 4, 5],
  weeklyTarget: 3,
  intervalEveryDays: 2,
  intervalAnchorDate: '',
  status: 'active',
  icon: 'sparkle',
  xpReward: 10
})

function formFromHabit(habit: Habit): HabitForm {
  return {
    id: habit.id,
    name: habit.name,
    category: habit.category,
    objective: habit.objective,
    minimumVersion: habit.minimumVersion,
    frequencyType: habit.frequency.type,
    weekdays: habit.frequency.type === 'weekdays' ? habit.frequency.weekdays : habit.frequency.type === 'weekly-target' ? habit.frequency.preferredWeekdays ?? [] : [],
    weeklyTarget: habit.frequency.type === 'weekly-target' ? habit.frequency.target : 3,
    intervalEveryDays: habit.frequency.type === 'interval' ? habit.frequency.everyDays : 2,
    intervalAnchorDate: habit.frequency.type === 'interval' ? habit.frequency.anchorDate : '',
    status: habit.status,
    icon: habit.icon ?? 'sparkle',
    xpReward: habit.xpReward
  }
}

function frequencyFromForm(form: HabitForm): HabitFrequency {
  if (form.frequencyType === 'daily') return { type: 'daily' }
  if (form.frequencyType === 'weekdays') return { type: 'weekdays', weekdays: form.weekdays as Array<0 | 1 | 2 | 3 | 4 | 5 | 6> }
  if (form.frequencyType === 'weekly-target') return { type: 'weekly-target', target: form.weeklyTarget, preferredWeekdays: form.weekdays as Array<0 | 1 | 2 | 3 | 4 | 5 | 6> }
  if (form.frequencyType === 'interval') return { type: 'interval', everyDays: form.intervalEveryDays, anchorDate: form.intervalAnchorDate }
  return { type: 'unscheduled' }
}

function frequencyLabel(frequency: HabitFrequency) {
  if (frequency.type === 'daily') return 'Todos os dias'
  if (frequency.type === 'weekdays') return `${frequency.weekdays.length} dias por semana`
  if (frequency.type === 'weekly-target') return `Meta de ${frequency.target}× por semana`
  if (frequency.type === 'interval') return `A cada ${frequency.everyDays} dias`
  return 'Ainda sem agenda'
}

const statusOptions = [
  { value: 'active', label: 'Ativos' },
  { value: 'all', label: 'Todos' },
  { value: 'future', label: 'Futuros' },
  { value: 'paused', label: 'Pausados' }
] as const

const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const

function orderedWeekdays(weekStartsOn: Weekday) {
  return Array.from({ length: 7 }, (_, offset) => ((weekStartsOn + offset) % 7) as Weekday)
}

export default function HabitsPage() {
  const { habits, habitLogs, settings, saveHabit, removeHabit } = useLifeOS()
  const { labels, options } = useCategories()
  const [params] = useSearchParams()
  const [filter, setFilter] = useState<(typeof statusOptions)[number]['value']>(params.get('filter') === 'future' ? 'future' : 'active')
  const [form, setForm] = useState<HabitForm | null>(params.get('new') === '1' ? emptyForm() : null)
  const [deleteTarget, setDeleteTarget] = useState<Habit | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const date = useCurrentDate(settings.timezone)
  const visible = useMemo(() => habits.filter((habit) => filter === 'all' || habit.status === filter), [habits, filter])
  const activeCount = habits.filter((habit) => habit.status === 'active' || habit.status === 'trial').length

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form || !form.name.trim() || !form.minimumVersion.trim()) return
    setFormError('')
    if (form.frequencyType === 'weekdays' && form.weekdays.length === 0) {
      setFormError('Escolha pelo menos um dia para esta frequência.')
      return
    }
    if (form.frequencyType === 'weekly-target' && (!Number.isInteger(form.weeklyTarget) || form.weeklyTarget < 1 || form.weeklyTarget > 7)) {
      setFormError('A meta semanal precisa ser um número inteiro entre 1 e 7.')
      return
    }
    if (form.frequencyType === 'weekly-target' && form.weekdays.length !== form.weeklyTarget) {
      setFormError(`Escolha exatamente ${form.weeklyTarget} ${form.weeklyTarget === 1 ? 'dia' : 'dias'} para a meta semanal.`)
      return
    }
    if (form.frequencyType === 'interval' && (!Number.isInteger(form.intervalEveryDays) || form.intervalEveryDays < 1 || !form.intervalAnchorDate)) {
      setFormError('Informe um intervalo inteiro e uma data inicial.')
      return
    }
    setSaving(true)
    try {
      const existing = form.id ? habits.find((habit) => habit.id === form.id) : undefined
      await saveHabit({
        id: form.id,
        name: form.name,
        category: form.category,
        objective: form.objective || form.minimumVersion,
        minimumVersion: form.minimumVersion,
        frequency: frequencyFromForm(form),
        status: form.status,
        xpReward: form.xpReward,
        icon: form.icon,
        startsOn: existing?.startsOn ?? (form.status === 'future' ? undefined : date),
        phaseId: existing?.phaseId,
        sortOrder: existing?.sortOrder
      })
      setForm(null)
      setFormError('')
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Não foi possível salvar o hábito.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page habits-page">
      <PageHeading
        eyebrow="Organização da rotina"
        title="Hábitos"
        description="Defina os itens que serão acompanhados no período atual."
        actions={<Button onClick={() => { setFormError(''); setForm({ ...emptyForm(), intervalAnchorDate: date }) }}><Plus size={16} /><span className="hide-mobile">Novo hábito</span></Button>}
      />

      <Card className="phase-banner">
        <span className="phase-banner__icon"><ListChecks size={23} /></span>
        <div><span className="eyebrow">Rotina atual</span><strong>{activeCount} hábitos ativos</strong><p>Mantenha o conjunto ativo compatível com o que será acompanhado nesta etapa.</p></div>
        <Badge tone="success">Em acompanhamento</Badge>
      </Card>

      <div className="habits-toolbar">
        <SegmentedControl value={filter} options={[...statusOptions]} onChange={setFilter} label="Filtrar hábitos" />
        <span>{visible.length} de {habits.length} hábitos</span>
      </div>

      {visible.length ? (
        <div className="habit-cards-grid">
          {visible.map((habit) => {
            const Icon = getIcon(habit.icon)
            const streak = calculateHabitStreak(habit, habitLogs, date)
            return (
              <Card className={`habit-manage-card habit-manage-card--${habit.status}`} key={habit.id}>
                <div className="habit-manage-card__top">
                  <span className={`habit-manage-card__icon habit-manage-card__icon--${habit.category}`}><Icon width={22} height={22} /></span>
                  <div><Badge tone={toneForHabitStatus(habit.status)}>{habitStatusLabels[habit.status]}</Badge><small>{labels[habit.category] ?? habit.category}</small></div>
                  <Button variant="ghost" size="icon" onClick={() => { setFormError(''); setForm(formFromHabit(habit)) }} aria-label={`Editar ${habit.name}`}><Edit3 size={15} /></Button>
                </div>
                <h2>{habit.name}</h2>
                <p>{habit.objective}</p>
                <div className="habit-minimum"><span>Opção reduzida</span><strong>{habit.minimumVersion}</strong></div>
                <div className="habit-manage-card__meta"><span>{frequencyLabel(habit.frequency)}</span></div>
                <div className="os-habit-level"><span>Nível {habit.level}</span><span>{habit.currentXp % 100}/100 XP</span></div>
                <ProgressBar value={habit.currentXp % 100} label={`${habit.name}: progresso do nível`} />
                <div className="habit-streaks"><span><Flame size={13} /><b>{streak.current}</b> dias atuais</span><span>Melhor: <b>{streak.best}</b> dias</span><span>+{habit.xpReward} XP por conclusão</span></div>
              </Card>
            )
          })}
        </div>
      ) : <Card><EmptyState title="Nenhum hábito neste filtro" description="Escolha outro status ou crie um novo hábito." action={<Button size="sm" onClick={() => setFilter('all')}>Ver todos</Button>} /></Card>}

      <Modal
        open={Boolean(form)}
        title={form?.id ? 'Editar hábito' : 'Criar hábito'}
        description="A opção reduzida registra uma execução parcial possível em dias de maior dificuldade."
        onClose={() => { setForm(null); setFormError('') }}
        wide
        footer={<><Button variant="secondary" onClick={() => { setForm(null); setFormError('') }}>Cancelar</Button><Button type="submit" form="habit-form" disabled={saving}>{saving ? 'Salvando…' : 'Salvar hábito'}</Button></>}
      >
        {form && (
          <form id="habit-form" className="form-grid" onSubmit={onSubmit}>
            <Field label="Nome" className="form-grid__wide"><input value={form.name} onChange={(event) => { setFormError(''); setForm({ ...form, name: event.target.value }) }} placeholder="Ex.: Preparar mochila" required autoFocus /></Field>
            <Field label="Categoria">
              <select value={form.category} onChange={(event) => { setFormError(''); setForm({ ...form, category: event.target.value as LifeArea }) }}>
                {options(form.category).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(event) => { setFormError(''); setForm({ ...form, status: event.target.value as HabitStatus }) }}>
                {Object.entries(habitStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="XP por conclusão" hint="Cada 100 XP sobe um nível. A conclusão parcial recebe metade."><input type="number" min="0" max="100" step="1" required value={form.xpReward} onChange={(event) => setForm({ ...form, xpReward: Number(event.target.value) })} /></Field>
            <Field label="Objetivo" className="form-grid__wide"><textarea value={form.objective} onChange={(event) => { setFormError(''); setForm({ ...form, objective: event.target.value }) }} placeholder="Por que este hábito existe?" /></Field>
            <Field label="Opção reduzida" hint="Descreva uma execução menor que ainda possa ser registrada." className="form-grid__wide"><input value={form.minimumVersion} onChange={(event) => { setFormError(''); setForm({ ...form, minimumVersion: event.target.value }) }} placeholder="Ex.: Conferir apenas a lista" required /></Field>
            <Field label="Frequência">
              <select value={form.frequencyType} onChange={(event) => { setFormError(''); setForm({ ...form, frequencyType: event.target.value as HabitFrequency['type'] }) }}>
                <option value="daily">Todos os dias</option><option value="weekdays">Dias escolhidos</option><option value="weekly-target">Meta semanal</option><option value="interval">A cada N dias</option><option value="unscheduled">Sem agenda ainda</option>
              </select>
            </Field>
            {(form.frequencyType === 'weekdays' || form.frequencyType === 'weekly-target') && (
              <div className="field form-grid__wide"><span className="field__label">Dias preferidos</span><div className="weekday-picker">{orderedWeekdays(settings.weekStartsOn).map((day) => <button type="button" key={day} aria-label={weekdayNames[day]} aria-pressed={form.weekdays.includes(day)} className={form.weekdays.includes(day) ? 'active' : ''} onClick={() => { setFormError(''); setForm({ ...form, weekdays: form.weekdays.includes(day) ? form.weekdays.filter((value) => value !== day) : [...form.weekdays, day] }) }}>{weekdayNames[day].slice(0, 1)}</button>)}</div></div>
            )}
            {form.frequencyType === 'weekly-target' && <Field label="Vezes por semana"><input type="number" min="1" max="7" value={form.weeklyTarget} onChange={(event) => { setFormError(''); setForm({ ...form, weeklyTarget: Number(event.target.value) }) }} /></Field>}
            {form.frequencyType === 'interval' && <><Field label="Repetir a cada (dias)"><input type="number" min="1" step="1" value={form.intervalEveryDays} onChange={(event) => { setFormError(''); setForm({ ...form, intervalEveryDays: Number(event.target.value) }) }} required /></Field><Field label="Começar em"><input type="date" value={form.intervalAnchorDate} onChange={(event) => { setFormError(''); setForm({ ...form, intervalAnchorDate: event.target.value }) }} required /></Field></>}
            {formError && <p className="form-error form-grid__wide" role="alert">{formError}</p>}
            {form.id && <div className="form-danger-zone form-grid__wide"><div><strong>Excluir este hábito</strong><p>Também remove os registros associados a ele.</p></div><Button variant="danger" size="sm" onClick={() => { const habit = habits.find((item) => item.id === form.id); if (habit) { setDeleteTarget(habit); setForm(null); setFormError('') } }}><Trash2 size={13} />Excluir</Button></div>}
          </form>
        )}
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="Excluir hábito?" description="Essa ação remove o hábito e o histórico dele deste dispositivo." onClose={() => setDeleteTarget(null)} footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button variant="danger" onClick={async () => { if (deleteTarget) await removeHabit(deleteTarget.id); setDeleteTarget(null) }}>Excluir definitivamente</Button></>}>
        <p className="modal-warning">Você está prestes a excluir “{deleteTarget?.name}”. Exporte um backup antes se quiser preservar esses dados.</p>
      </Modal>
    </div>
  )
}

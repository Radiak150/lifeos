import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Check, Circle, Clock3, Edit3, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useLifeOS } from '../app/LifeOSProvider'
import { PageTabs } from '../components/PageTabs'
import { PageHeading } from '../components/PageHeading'
import { Badge, Button, Card, EmptyState, Field, Modal, ProgressBar, SegmentedControl } from '../components/ui'
import type { ModuleName, ModuleTask, ModuleTaskKind, ModuleTaskStatus, RecurrenceRule, TaskPriority } from '../domain/types'
import { getIcon, moduleMeta } from '../lib/presentation'

import { useCategories } from '../hooks/useCategories'

type SupportedModule = ModuleName

const taskStatuses: Array<{ value: ModuleTaskStatus; label: string }> = [
  { value: 'backlog', label: 'A fazer' },
  { value: 'planned', label: 'Planejado' },
  { value: 'in-progress', label: 'Em andamento' },
  { value: 'done', label: 'Concluído' },
  { value: 'paused', label: 'Pausado' }
]

const statusLabel = Object.fromEntries(taskStatuses.map((status) => [status.value, status.label]))
const weekdayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

type TaskForm = {
  id?: string
  title: string
  description: string
  status: ModuleTaskStatus
  priority: TaskPriority
  dueDate: string
  progressPercent: number
  kind: ModuleTaskKind
}

const emptyTask = (): TaskForm => ({ title: '', description: '', status: 'backlog', priority: 'medium', dueDate: '', progressPercent: 0, kind: 'task' })

function taskForm(task: ModuleTask): TaskForm {
  return { id: task.id, title: task.title, description: task.description ?? '', status: task.status, priority: task.priority ?? 'medium', dueDate: task.dueDate ?? '', progressPercent: task.progressPercent ?? (task.status === 'done' ? 100 : 0), kind: task.kind ?? 'task' }
}

function protectedBlockPage(module: SupportedModule) {
  return module === 'relationship'
}

export default function ModulePage({ module }: { module: SupportedModule }) {
  const { moduleTasks, scheduleItems, saveTask, removeTask, saveScheduleItem, removeScheduleItem, settings } = useLifeOS()
  const { categories, labels } = useCategories()
  const custom = categories.find(c => c.id === module)
  const base = moduleMeta[module as keyof typeof moduleMeta]
  const meta = custom ? { title: custom.name, subtitle: 'Tarefas e próximos passos deste assunto.', icon: getIcon(custom.icon), color: custom.color }
    : { ...base, title: settings.onboarding ? labels[module] : base.title,
        subtitle: settings.onboarding && module === 'relationship' ? 'Reserve tempo com pessoas importantes para você.' : base.subtitle }
  const Icon = meta.icon
  const tasks = useMemo(() => moduleTasks.filter((task) => task.module === module), [moduleTasks, module])
  const blocks = useMemo(() => scheduleItems.filter((item) => item.category === module), [scheduleItems, module])
  const [view, setView] = useState('tasks')
  const [filter, setFilter] = useState<'all' | ModuleTaskStatus>('all')
  const [kindFilter, setKindFilter] = useState<'all' | ModuleTaskKind>('all')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<TaskForm | null>(null)
  const [blockForm, setBlockForm] = useState(false)
  const [blockTitle, setBlockTitle] = useState(settings.onboarding ? 'Tempo juntos' : 'Tempo juntos')
  const [blockStart, setBlockStart] = useState('')
  const [blockEnd, setBlockEnd] = useState('')
  const [blockDays, setBlockDays] = useState<number[]>([])
  const visible = tasks.filter((task) => (filter === 'all' || task.status === filter) && (kindFilter === 'all' || (task.kind ?? 'task') === kindFilter))

  const submitTask = async (event: FormEvent) => {
    event.preventDefault()
    if (!form?.title.trim()) return
    setSaving(true); setError('')
    try {
      await saveTask({ id: form.id, module: module as ModuleName, kind: form.kind, title: form.title, description: form.description, status: form.status, priority: form.priority, dueDate: form.dueDate || undefined, progressPercent: form.status === 'done' ? 100 : form.progressPercent })
      setForm(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.') }
    finally { setSaving(false) }
  }

  const submitBlock = async (event: FormEvent) => {
    event.preventDefault()
    if (!blockTitle.trim() || !blockStart || !blockDays.length) return
    const recurrence: RecurrenceRule = { type: 'weekly', weekdays: blockDays as Array<0 | 1 | 2 | 3 | 4 | 5 | 6> }
    setSaving(true); setError('')
    try {
      await saveScheduleItem({ title: blockTitle, category: 'relationship', recurrence, startTime: blockStart, endTime: blockEnd || undefined, protectedTime: true, color: 'red' })
      setBlockForm(false); setBlockStart(''); setBlockEnd(''); setBlockDays([])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o bloco.') }
    finally { setSaving(false) }
  }

  if (protectedBlockPage(module)) {
    return (
      <div className="page module-page">
        <PageHeading eyebrow="Tempo protegido" title={meta.title} description={meta.subtitle} actions={<Button onClick={() => setBlockForm(true)}><Plus size={16} /><span className="hide-mobile">Novo bloco</span></Button>} />
        <Card className="relationship-intro"><span><ShieldCheck size={26} /></span><div><strong>Afeto não é tarefa</strong><p>Esta área reserva espaço no calendário. Os blocos não dão XP, não criam cobrança e não entram na porcentagem diária.</p></div></Card>
        <div className="protected-blocks-grid">
          {blocks.length ? blocks.map((block) => <Card className="protected-block" key={block.id}><span className="protected-block__icon"><CalendarClock size={22} /></span><div><Badge tone="danger">Tempo protegido</Badge><h2>{block.title}</h2><p>{block.startTime}{block.endTime ? ` – ${block.endTime}` : ''}</p><small>{block.recurrence.type === 'weekly' ? `${block.recurrence.weekdays.length} dias por semana` : block.recurrence.type === 'daily' ? 'Todos os dias' : 'Data específica'}</small><Link className="button button--ghost button--sm" to={`/settings?tab=schedule&edit=${encodeURIComponent(block.id)}`}>Editar horário</Link></div><Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`Excluir o bloco “${block.title}”?`)) void removeScheduleItem(block.id) }} aria-label={`Excluir ${block.title}`}><Trash2 size={15} /></Button></Card>) : <Card><EmptyState title="Nenhum bloco protegido" description="Quando você souber um bom horário, reserve aqui sem transformar o relacionamento em checklist." action={<Button size="sm" onClick={() => setBlockForm(true)}>Criar primeiro bloco</Button>} /></Card>}
        </div>
        <Modal open={blockForm} title="Novo tempo protegido" description="Escolha um horário realista; ele poderá ser alterado depois." onClose={() => setBlockForm(false)} footer={<><Button variant="secondary" onClick={() => setBlockForm(false)}>Cancelar</Button><Button type="submit" form="protected-block-form" disabled={saving}>Salvar bloco</Button></>}>
          <form id="protected-block-form" className="form-grid" onSubmit={submitBlock}>
            {error && <p className="form-error form-grid__wide" role="alert">{error}</p>}
            <Field label="Nome" className="form-grid__wide"><input value={blockTitle} onChange={(event) => setBlockTitle(event.target.value)} required /></Field>
            <Field label="Começa"><input type="time" value={blockStart} onChange={(event) => setBlockStart(event.target.value)} required /></Field>
            <Field label="Termina"><input type="time" value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} /></Field>
            <div className="field form-grid__wide"><span className="field__label">Dias da semana</span><div className="weekday-picker" role="group" aria-label="Dias da semana">{['D','S','T','Q','Q','S','S'].map((label, index) => <button type="button" key={`${label}${index}`} className={blockDays.includes(index) ? 'active' : ''} aria-label={weekdayNames[index]} aria-pressed={blockDays.includes(index)} onClick={() => setBlockDays(blockDays.includes(index) ? blockDays.filter((day) => day !== index) : [...blockDays, index])}>{label}</button>)}</div></div>
          </form>
        </Modal>
      </div>
    )
  }

  const done = tasks.filter((task) => task.status === 'done').length
  const overall = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + (task.progressPercent ?? (task.status === 'done' ? 100 : 0)), 0) / tasks.length) : 0

  return (
    <div className={`page module-page module-page--${module}`}>
      <PageHeading eyebrow={labels[module] ?? 'Projeto'} title={meta.title} description={meta.subtitle} actions={<Button onClick={() => setForm(emptyTask())}><Plus size={16} /><span className="hide-mobile">Nova entrada</span></Button>} />
      <Card hidden={view !== 'summary'} className={`area-banner area-banner--${meta.color}`}><span><Icon width={37} height={37} /></span><div><h2>{module === 'fitness' ? 'Retomar aos poucos' : module === 'fushi' ? 'Do plano ao próximo passo' : module === 'college' ? 'Um próximo passo por entrega' : module === 'home' ? 'Espaço para cuidar de casa' : 'Demandas e próximos passos'}</h2><p>{module === 'fitness' ? 'Escolha os dias e o tipo de movimento que fazem parte da sua rotina.' : meta.subtitle}</p></div><Link className="button button--secondary button--sm" to="/settings?tab=schedule"><CalendarClock size={15} />Organizar horários</Link></Card>
      <PageTabs value={view} onChange={setView} label="Área" items={[{id:'tasks',label:'Tarefas'},{id:'summary',label:'Resumo'}]} />
      {module === 'fushi' && view === 'tasks' && <div className="module-kind-tabs"><SegmentedControl value={kindFilter} options={[{value:'all',label:'Tudo'},{value:'task',label:'Tarefas'},{value:'bug',label:'Bugs'},{value:'content',label:'Conteúdo'},{value:'session',label:'Sessões'}]} onChange={setKindFilter} label="Tipo de projeto" /></div>}
      <div className="module-summary-grid" hidden={view !== 'summary'}>
        <Card><span className={`module-summary__icon module-summary__icon--${meta.color}`}><Icon width={22} height={22} /></span><div><strong>{tasks.length}</strong><small>Itens registrados</small></div></Card>
        <Card><span className="module-summary__icon module-summary__icon--green"><Check size={22} /></span><div><strong>{done}</strong><small>Concluídos</small></div></Card>
        <Card><span className="module-summary__icon module-summary__icon--blue"><Clock3 size={22} /></span><div><strong>{tasks.filter((task) => task.status === 'in-progress').length}</strong><small>Em andamento</small></div></Card>
        <Card className="module-progress-summary"><div><strong>{overall}%</strong><small>Progresso informado</small></div><ProgressBar value={overall} tone={meta.color} label={`Progresso geral de ${meta.title}: ${overall}%`} /></Card>
      </div>
      <div className="module-toolbar" hidden={view !== 'tasks'}><SegmentedControl value={filter} options={[{ value: 'all', label: 'Todos' }, ...taskStatuses.map(({ value, label }) => ({ value, label }))]} onChange={setFilter} label="Filtrar itens" /><span aria-live="polite">{visible.length} itens</span></div>
      <div hidden={view !== 'tasks'}>{visible.length ? <div className="module-task-grid">{visible.map((task) => { const taskProgress = task.progressPercent ?? (task.status === 'done' ? 100 : 0); return <Card className={`module-task module-task--${task.status}`} key={task.id}><div className="module-task__top"><Badge tone={task.priority === 'high' ? 'danger' : task.priority === 'low' ? 'neutral' : 'warning'}>{task.priority === 'high' ? 'Alta' : task.priority === 'low' ? 'Baixa' : 'Média'}</Badge><Button variant="ghost" size="icon" onClick={() => setForm(taskForm(task))} aria-label={`Editar ${task.title}`}><Edit3 size={14} /></Button></div><h2>{task.title}</h2><p>{task.description || 'Sem descrição adicional.'}</p><small className="os-task-kind">{({ task: 'Tarefa', bug: 'Bug', content: 'Conteúdo', session: 'Sessão', study: 'Estudo', training: 'Treino' })[task.kind ?? 'task']}</small><div className="module-task__status"><span className={`task-status-dot task-status-dot--${task.status}`}><Circle size={9} fill="currentColor" /></span>{statusLabel[task.status]}</div>{task.dueDate && <span className="module-task__due"><CalendarClock size={12} />{task.dueDate.split('-').reverse().join('/')}</span>}<ProgressBar value={taskProgress} tone={meta.color} label={`${task.title}: ${taskProgress}%`} /></Card> })}</div> : <Card><EmptyState title="Nenhum item registrado" description={`Organize os próximos passos de ${meta.title}.`} action={<Button size="sm" onClick={() => setForm(emptyTask())}>Adicionar primeiro item</Button>} /></Card>}</div>
      <Modal open={Boolean(form)} title={form?.id ? 'Editar item' : 'Novo item'} description={`Este registro ficará na área ${meta.title}.`} onClose={() => setForm(null)} wide footer={<><Button variant="secondary" onClick={() => setForm(null)}>Cancelar</Button><Button type="submit" form="module-task-form" disabled={saving}>Salvar</Button></>}>
        {form && <form id="module-task-form" className="form-grid" onSubmit={submitTask}>
          {error && <p className="form-error form-grid__wide" role="alert">{error}</p>}
          <Field label="Tipo"><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as ModuleTaskKind })}><option value="task">Tarefa</option><option value="bug">Bug</option><option value="content">Conteúdo</option><option value="session">Sessão</option><option value="study">Estudo</option><option value="training">Treino</option></select></Field>
          <Field label="Título" className="form-grid__wide"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required autoFocus /></Field>
          <Field label="Status"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ModuleTaskStatus })}>{taskStatuses.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}</select></Field>
          <Field label="Prioridade"><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></Field>
          <Field label="Descrição" className="form-grid__wide"><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          <Field label="Prazo"><input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>
          <Field label="Progresso (%)"><input type="number" min="0" max="100" value={form.progressPercent} onChange={(event) => setForm({ ...form, progressPercent: Number(event.target.value) })} /></Field>
          {form.id && <div className="form-danger-zone form-grid__wide"><div><strong>Excluir item</strong><p>Remove somente este registro.</p></div><Button variant="danger" size="sm" onClick={async () => { if (!window.confirm(`Excluir o item “${form.title}”?`)) return; await removeTask(form.id!); setForm(null) }}><Trash2 size={13} />Excluir</Button></div>}
        </form>}
      </Modal>
    </div>
  )
}

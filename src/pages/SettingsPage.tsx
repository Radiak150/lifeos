import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Edit3, HardDrive, Plus, RotateCcw, Save, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useLifeOS, type LifeOSBackup } from '../app/LifeOSProvider'
import { PageHeading } from '../components/PageHeading'
import { Badge, Button, Card, CardHeader, Field, Modal, SegmentedControl } from '../components/ui'
import type { LifeArea, LifeOSSettings, RecurrenceRule, ScheduleItem, Weekday } from '../domain/types'
import { usePersistentStorage } from '../hooks/usePersistentStorage'
import { useCategories } from '../hooks/useCategories'

type Tab = 'profile' | 'system' | 'schedule' | 'data'

type ScheduleForm = {
  id?: string
  title: string
  category: LifeArea
  recurrenceType: RecurrenceRule['type']
  weekdays: number[]
  date: string
  startTime: string
  endTime: string
  location: string
  note: string
  protectedTime: boolean
  active: boolean
  color: string
  dayOffset: 0 | 1
}

const emptySchedule = (): ScheduleForm => ({ title: '', category: 'other', recurrenceType: 'weekly', weekdays: [], date: '', startTime: '', endTime: '', location: '', note: '', protectedTime: false, active: true, color: 'green', dayOffset: 0 })

function scheduleForm(item: ScheduleItem): ScheduleForm {
  return { id: item.id, title: item.title, category: item.category, recurrenceType: item.recurrence.type, weekdays: item.recurrence.type === 'weekly' ? item.recurrence.weekdays : [], date: item.recurrence.type === 'one-off' ? item.recurrence.date : '', startTime: item.startTime, endTime: item.endTime ?? '', location: item.location ?? '', note: item.note ?? '', protectedTime: item.protectedTime, active: item.active, color: item.color ?? 'green', dayOffset: item.dayOffset ?? 0 }
}

const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const

function orderedWeekdays(weekStartsOn: Weekday) {
  return Array.from({ length: 7 }, (_, offset) => ((weekStartsOn + offset) % 7) as Weekday)
}

function formatStorage(bytes: number | null) {
  if (bytes == null) return null
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
}

export default function SettingsPage() {
  const { settings, scheduleItems, updateSettings, saveScheduleItem, removeScheduleItem, createBackup, restoreBackup, resetLocalData } = useLifeOS()
  const { options } = useCategories()
  const [params] = useSearchParams()
  const initialTab = params.get('tab') as Tab
  const initialSchedule = scheduleItems.find((item) => item.id === params.get('edit'))
  const [tab, setTab] = useState<Tab>(['profile','system','schedule','data'].includes(initialTab) ? initialTab : 'profile')
  const [profile, setProfile] = useState(settings.profile)
  const [weekStartsOn, setWeekStartsOn] = useState(settings.weekStartsOn)
  const [appearance, setAppearance] = useState(settings.appearance)
  const [waterGoalMl, setWaterGoalMl] = useState(settings.waterGoalMl)
  const [completion, setCompletion] = useState(settings.completion)
  const [schedule, setSchedule] = useState<ScheduleForm | null>(initialSchedule ? scheduleForm(initialSchedule) : params.get('new') === '1' ? emptySchedule() : null)
  const [scheduleDeleteTarget, setScheduleDeleteTarget] = useState<ScheduleItem | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'warning' | 'danger' } | null>(null)
  const storage = usePersistentStorage()

  const hydrateSettingsDrafts = (next: LifeOSSettings) => {
    setProfile(next.profile)
    setWeekStartsOn(next.weekStartsOn)
    setAppearance(next.appearance)
    setWaterGoalMl(next.waterGoalMl)
    setCompletion(next.completion)
  }

  const flash = (text: string, tone: 'success' | 'warning' | 'danger' = 'success') => {
    setNotice({ text, tone })
    window.setTimeout(() => setNotice(null), 4200)
  }

  const selectTab = (next: Tab) => {
    if (next === 'profile') setProfile(settings.profile)
    if (next === 'system') {
      setWeekStartsOn(settings.weekStartsOn)
      setAppearance(settings.appearance)
      setWaterGoalMl(settings.waterGoalMl)
      setCompletion(settings.completion)
    }
    setTab(next)
  }

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()
    try { await updateSettings({ profile }); flash('Perfil salvo neste dispositivo.') }
    catch { flash('Não foi possível salvar o perfil.', 'danger') }
  }
  const saveSystem = async (event: FormEvent) => {
    event.preventDefault()
    try { await updateSettings({ weekStartsOn, appearance, waterGoalMl, completion }); flash('Preferências aplicadas.') }
    catch { flash('Não foi possível aplicar as preferências.', 'danger') }
  }

  const saveSchedule = async (event: FormEvent) => {
    event.preventDefault()
    if (!schedule?.title.trim() || !schedule.startTime) return
    if (schedule.recurrenceType === 'weekly' && schedule.weekdays.length === 0) {
      flash('Escolha pelo menos um dia para o bloco semanal.', 'danger')
      return
    }
    if (schedule.recurrenceType === 'one-off' && !schedule.date) {
      flash('Escolha a data do bloco pontual.', 'danger')
      return
    }
    if (schedule.endTime && schedule.endTime === schedule.startTime) {
      flash('Início e fim não podem ser iguais.', 'danger')
      return
    }
    const recurrence: RecurrenceRule = schedule.recurrenceType === 'daily' ? { type: 'daily' } : schedule.recurrenceType === 'one-off' ? { type: 'one-off', date: schedule.date } : { type: 'weekly', weekdays: schedule.weekdays as Array<0|1|2|3|4|5|6> }
    try {
      await saveScheduleItem({ id: schedule.id, title: schedule.title, category: schedule.category, recurrence, startTime: schedule.startTime, endTime: schedule.endTime || undefined, dayOffset: schedule.dayOffset, location: schedule.location, note: schedule.note, protectedTime: schedule.protectedTime, active: schedule.active, color: schedule.color })
      setSchedule(null); flash('Bloco de agenda salvo.')
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'Não foi possível salvar o bloco.', 'danger')
    }
  }

  const exportData = async () => {
    try {
      const backup = await createBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `lifeos-backup-${new Date().toISOString().slice(0,10)}.json`; link.click()
      URL.revokeObjectURL(url); flash('Backup exportado com sucesso.')
    } catch { flash('Não foi possível criar o backup.', 'danger') }
  }

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as LifeOSBackup
      await restoreBackup(parsed)
      hydrateSettingsDrafts(parsed.data.settings[0] ?? settings)
      await storage.refresh()
      flash('Backup restaurado com sucesso.')
    }
    catch (cause) { flash(cause instanceof Error ? cause.message : 'Não foi possível importar o arquivo.', 'danger') }
    event.target.value = ''
  }

  const requestPersistentStorage = async () => {
    try {
      const granted = await storage.requestPersistence()
      flash(granted ? 'O navegador confirmou armazenamento persistente.' : 'O navegador não garantiu persistência. Mantenha backups regulares.', granted ? 'success' : 'warning')
    } catch {
      flash('Não foi possível solicitar persistência ao navegador.', 'danger')
    }
  }

  return (
    <div className="page settings-page">
      <PageHeading eyebrow="Preferências" title="Configurações" description="Perfil, metas, aparência, agenda e cópia de segurança." actions={notice ? <Badge tone={notice.tone}><Save size={11} />{notice.text}</Badge> : undefined} />
      <div className="settings-tabs"><SegmentedControl value={tab} options={[{ value: 'profile', label: 'Perfil' }, { value: 'system', label: 'Metas e aparência' }, { value: 'schedule', label: 'Agenda' }, { value: 'data', label: 'Dados' }]} onChange={selectTab} label="Seções dos ajustes" /></div>

      {tab === 'profile' && <div className="settings-grid settings-grid--single">
        <Card className="settings-card"><CardHeader eyebrow="Personalização opcional" title="Como o app chama você" /><form className="settings-form" onSubmit={saveProfile}>
          <Field label="Como quer ser chamado"><input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} placeholder="Seu nome" /></Field>
          <p className="settings-help form-grid__wide">O nome não é obrigatório. A aplicação funciona sem cadastro e não solicita dados pessoais para começar.</p>
          <div className="settings-form__actions form-grid__wide"><Button type="submit"><Save size={14} />Salvar perfil</Button></div>
        </form></Card>
      </div>}

      {tab === 'system' && <div className="settings-grid">
        <Card className="settings-card"><CardHeader eyebrow="Preferências pessoais" title="Metas e cores do calendário" /><form className="settings-form" onSubmit={saveSystem}><Field label="Meta diária de água (ml)"><input type="number" min="100" max="10000" step="50" value={waterGoalMl} onChange={(event) => setWaterGoalMl(Number(event.target.value))} required /></Field><Field label="Dia excelente a partir de (%)"><input type="number" min="1" max="100" value={completion.excellentAt} onChange={(event) => setCompletion({ ...completion, excellentAt: Number(event.target.value) })} required /></Field><Field label="Dia parcial a partir de (%)"><input type="number" min="0" max={completion.excellentAt - 1} value={completion.partialAt} onChange={(event) => setCompletion({ ...completion, partialAt: Number(event.target.value) })} required /></Field><p className="settings-help">Água é uma meta pessoal. As cores resumem apenas os hábitos ativos.</p><Button type="submit"><Save size={14} />Salvar metas</Button></form></Card>
        <Card className="settings-card"><CardHeader eyebrow="Calendário" title="Organização da semana" /><form className="settings-form" onSubmit={saveSystem}><Field label="Primeiro dia da semana"><select value={weekStartsOn} onChange={(event) => setWeekStartsOn(Number(event.target.value) as Weekday)}><option value="0">Domingo</option><option value="1">Segunda-feira</option></select></Field><p className="settings-help form-grid__wide">Os cálculos usam uma regra fixa e transparente: feito vale 1, parcial vale 0,5 e não feito vale 0.</p><div className="settings-form__actions form-grid__wide"><Button type="submit"><Save size={14} />Aplicar</Button></div></form></Card>
        <Card className="settings-card"><CardHeader eyebrow="Acessibilidade" title="Aparência e foco" /><form className="settings-switches" onSubmit={saveSystem}><Field label="Densidade"><select value={appearance.density} onChange={(event) => setAppearance({ ...appearance, density: event.target.value as 'comfortable'|'compact' })}><option value="comfortable">Confortável</option><option value="compact">Compacta</option></select></Field><Field label="Tamanho do texto"><select value={appearance.fontScale} onChange={(event) => setAppearance({ ...appearance, fontScale: Number(event.target.value) as 0.9|1|1.1|1.2 })}><option value="0.9">90%</option><option value="1">100%</option><option value="1.1">110%</option><option value="1.2">120%</option></select></Field><label className="switch-row"><input type="checkbox" checked={appearance.reduceMotion} onChange={(event) => setAppearance({ ...appearance, reduceMotion: event.target.checked })} /><span><strong>Reduzir animações</strong><small>Evita movimentos desnecessários.</small></span></label><label className="switch-row"><input type="checkbox" checked={appearance.highContrast} onChange={(event) => setAppearance({ ...appearance, highContrast: event.target.checked })} /><span><strong>Contraste reforçado</strong><small>Bordas e textos mais evidentes.</small></span></label><label className="switch-row"><input type="checkbox" checked={appearance.focusMode} onChange={(event) => setAppearance({ ...appearance, focusMode: event.target.checked })} /><span><strong>Modo foco</strong><small>Prioriza ação atual no dashboard.</small></span></label><div className="settings-form__actions"><Button type="submit"><Save size={14} />Aplicar aparência</Button></div></form></Card>
      </div>}

      {tab === 'schedule' && <Card className="schedule-settings-card"><CardHeader eyebrow="Fonte única da timeline" title="Blocos recorrentes" action={<Button size="sm" onClick={() => setSchedule(emptySchedule())}><Plus size={14} />Novo bloco</Button>} /><div className="schedule-settings-list">{[...scheduleItems].sort((a,b) => a.startTime.localeCompare(b.startTime)).map((item) => <div key={item.id}><span className={`schedule-color schedule-color--${item.color ?? 'green'}`} /><time>{item.startTime}</time><span><strong>{item.title}</strong><small>{item.recurrence.type === 'weekly' ? `${item.recurrence.weekdays.length} dias/semana` : item.recurrence.type === 'daily' ? 'Todos os dias' : item.recurrence.date}{item.location ? ` · ${item.location}` : ''}</small></span>{item.protectedTime && <Badge tone="info">Protegido</Badge>}<Button variant="ghost" size="icon" onClick={() => setSchedule(scheduleForm(item))} aria-label={`Editar ${item.title}`}><Edit3 size={15} /></Button></div>)}</div></Card>}

      {tab === 'data' && <div className="settings-grid settings-grid--single">
        <Card className="settings-card data-card"><CardHeader eyebrow="Salvamento local" title="Dados deste dispositivo" /><div className="data-card__status"><span><HardDrive size={24} /></span><div><strong>{storage.checking ? 'Verificando armazenamento' : storage.persisted ? 'Dados preservados pelo navegador' : 'Cópia de segurança recomendada'}</strong><p>{storage.supported ? <>{formatStorage(storage.usage) ? `${formatStorage(storage.usage)}${formatStorage(storage.quota) ? ` de ${formatStorage(storage.quota)}` : ''} em uso. ` : ''}{storage.persisted ? 'O navegador confirmou a preservação automática.' : 'Os registros ficam neste navegador. Exporte uma cópia antes de limpar dados ou trocar de dispositivo.'}</> : 'Os registros ficam neste navegador. Exporte uma cópia antes de limpar dados ou trocar de dispositivo.'}</p></div><Badge tone={storage.persisted ? 'success' : storage.checking ? 'info' : 'warning'}>{storage.persisted ? 'Preservado' : storage.checking ? 'Verificando' : 'Faça backup'}</Badge></div><div className="data-actions"><Button variant="secondary" onClick={exportData}><Download size={15} />Exportar cópia</Button><label className="button button--secondary button--md"><Upload size={15} />Importar cópia<input type="file" accept="application/json,.json" onChange={importData} hidden /></label>{storage.supported && !storage.persisted && !storage.checking && <Button variant="secondary" onClick={() => void requestPersistentStorage()}><ShieldCheck size={15} />Preservar no navegador</Button>}</div><div className="data-danger"><div><strong>Recomeçar o aplicativo</strong><p>Exclui os registros e mantém somente a estrutura inicial.</p></div><Button variant="danger" size="sm" onClick={() => setResetOpen(true)}><RotateCcw size={13} />Recomeçar</Button></div></Card>
      </div>}

      <Modal open={Boolean(schedule)} title={schedule?.id ? 'Editar bloco' : 'Novo bloco de agenda'} description="A timeline usa estes dados diretamente." onClose={() => setSchedule(null)} wide footer={<><Button variant="secondary" onClick={() => setSchedule(null)}>Cancelar</Button><Button type="submit" form="schedule-form">Salvar bloco</Button></>}>
        {schedule && <form id="schedule-form" className="form-grid" onSubmit={saveSchedule}><Field label="Título" className="form-grid__wide"><input value={schedule.title} onChange={(event) => setSchedule({ ...schedule, title: event.target.value })} required /></Field><Field label="Categoria"><select value={schedule.category} onChange={(event) => setSchedule({ ...schedule, category: event.target.value as LifeArea })}>{options(schedule.category).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Recorrência"><select value={schedule.recurrenceType} onChange={(event) => setSchedule({ ...schedule, recurrenceType: event.target.value as RecurrenceRule['type'] })}><option value="weekly">Semanal</option><option value="daily">Diária</option><option value="one-off">Data específica</option></select></Field><Field label="Início"><input type="time" value={schedule.startTime} onChange={(event) => setSchedule({ ...schedule, startTime: event.target.value })} required /></Field><Field label="Fim"><input type="time" value={schedule.endTime} onChange={(event) => setSchedule({ ...schedule, endTime: event.target.value })} /></Field>{schedule.recurrenceType === 'weekly' && <div className="field form-grid__wide"><span className="field__label">Dias</span><div className="weekday-picker">{orderedWeekdays(weekStartsOn).map((day) => <button type="button" key={day} className={schedule.weekdays.includes(day) ? 'active' : ''} aria-label={weekdayNames[day]} aria-pressed={schedule.weekdays.includes(day)} onClick={() => setSchedule({ ...schedule, weekdays: schedule.weekdays.includes(day) ? schedule.weekdays.filter((value) => value !== day) : [...schedule.weekdays, day] })}>{weekdayNames[day].slice(0, 1)}</button>)}</div></div>}{schedule.recurrenceType === 'one-off' && <Field label="Data"><input type="date" value={schedule.date} onChange={(event) => setSchedule({ ...schedule, date: event.target.value })} required /></Field>}<Field label="Posição na rotina"><select value={schedule.dayOffset} onChange={(event) => setSchedule({ ...schedule, dayOffset: Number(event.target.value) as 0 | 1 })}><option value="0">No próprio dia</option><option value="1">Madrugada do dia seguinte</option></select></Field><Field label="Cor"><select value={schedule.color} onChange={(event) => setSchedule({ ...schedule, color: event.target.value })}><option value="green">Verde</option><option value="purple">Violeta</option><option value="blue">Azul</option><option value="yellow">Amarelo</option><option value="red">Rosa</option></select></Field><Field label="Local"><input value={schedule.location} onChange={(event) => setSchedule({ ...schedule, location: event.target.value })} /></Field><Field label="Observação" className="form-grid__wide"><textarea value={schedule.note} onChange={(event) => setSchedule({ ...schedule, note: event.target.value })} /></Field><label className="switch-row"><input type="checkbox" checked={schedule.protectedTime} onChange={(event) => setSchedule({ ...schedule, protectedTime: event.target.checked })} /><span><strong>Tempo protegido</strong><small>Sem cobrança de produtividade.</small></span></label><label className="switch-row"><input type="checkbox" checked={schedule.active} onChange={(event) => setSchedule({ ...schedule, active: event.target.checked })} /><span><strong>Bloco ativo</strong><small>Aparece na timeline.</small></span></label>{schedule.id && <div className="form-danger-zone form-grid__wide"><div><strong>Excluir bloco</strong><p>Remove este item da timeline.</p></div><Button type="button" variant="danger" size="sm" onClick={() => { const item = scheduleItems.find((entry) => entry.id === schedule.id); if (item) { setScheduleDeleteTarget(item); setSchedule(null) } }}><Trash2 size={13} />Excluir</Button></div>}</form>}
      </Modal>
      <Modal open={Boolean(scheduleDeleteTarget)} title="Excluir bloco da agenda?" description={scheduleDeleteTarget ? `"${scheduleDeleteTarget.title}" será removido da timeline.` : undefined} onClose={() => setScheduleDeleteTarget(null)} footer={<><Button variant="secondary" onClick={() => setScheduleDeleteTarget(null)}>Cancelar</Button><Button variant="danger" onClick={async () => { if (!scheduleDeleteTarget) return; try { await removeScheduleItem(scheduleDeleteTarget.id); setScheduleDeleteTarget(null); flash('Bloco removido da agenda.') } catch { flash('Não foi possível excluir o bloco.', 'danger') } }}>Excluir bloco</Button></>}><p className="modal-warning">Esta ação não pode ser desfeita sem restaurar um backup anterior.</p></Modal>
      <Modal open={resetOpen} title="Recomeçar o LifeOS?" description="Esta ação apaga todos os registros deste navegador." onClose={() => setResetOpen(false)} footer={<><Button variant="secondary" onClick={() => setResetOpen(false)}>Cancelar</Button><Button variant="danger" onClick={async () => { try { await resetLocalData(); setResetOpen(false); flash('Aplicativo restaurado.') } catch(e) { setResetOpen(false); flash(e instanceof Error ? e.message : 'Não foi possível recomeçar.', 'danger') } }}>Apagar e recomeçar</Button></>}><p className="modal-warning">Exporte uma cópia antes. Depois da confirmação, hábitos personalizados, conclusões, sono e observações não poderão ser recuperados deste dispositivo.</p></Modal>
    </div>
  )
}

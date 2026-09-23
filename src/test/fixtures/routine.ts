import { DEFAULT_IDS } from '../../data/defaults'
import type { ModuleTask, ProfileSettings, ScheduleItem } from '../../domain/types'

// Dados inteiramente sintéticos, importados somente pelos testes.
const stamp = '2026-01-01T00:00:00.000Z'
const schedule = (value: Omit<ScheduleItem, 'createdAt' | 'updatedAt' | 'active'>): ScheduleItem => ({
  ...value, active: true, createdAt: stamp, updatedAt: stamp,
})

export const SYNTHETIC_PROFILE: ProfileSettings = {
  displayName: 'Pessoa de teste', hasCat: true, occupation: 'Profissão de teste',
  employer: 'Empresa fictícia', client: 'Cliente fictício', college: 'Instituição fictícia', degree: 'Curso de teste',
}

export const SYNTHETIC_SCHEDULE_ITEMS: readonly ScheduleItem[] = [
  schedule({ id: DEFAULT_IDS.schedule.work, title: 'Bloco de teste', category: 'work', recurrence: { type: 'weekly', weekdays: [1, 2, 3, 4, 5] }, startTime: '09:00', endTime: '10:00', protectedTime: false }),
  schedule({ id: 'schedule:test-next-day', title: 'Madrugada de teste', category: 'sleep', recurrence: { type: 'daily' }, startTime: '02:00', dayOffset: 1, protectedTime: true }),
  schedule({ id: 'schedule:test-weekly-a', title: 'Evento semanal A', category: 'personal', recurrence: { type: 'weekly', weekdays: [3] }, startTime: '11:00', protectedTime: true }),
  schedule({ id: 'schedule:test-weekly-b', title: 'Evento semanal B', category: 'personal', recurrence: { type: 'weekly', weekdays: [0] }, startTime: '18:00', protectedTime: false }),
]

export const SYNTHETIC_MODULE_TASKS: readonly ModuleTask[] = [
  { id: DEFAULT_IDS.task.collegeTcc, module: 'college', title: 'Tarefa de estudo de teste', description: 'Descrição sintética.', status: 'backlog', createdAt: stamp, updatedAt: stamp },
]

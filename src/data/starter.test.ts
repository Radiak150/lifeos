import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LifeOSDatabase, seedDatabaseIfNeeded } from './db'
import { DEFAULT_HABITS, DEFAULT_SETTINGS, DEFAULT_IDS } from './defaults'
import { finishOnboarding, type StarterDraft } from './starter'
import { lifeOSDataOperations } from '../app/LifeOSProvider'
import { normalizeAndValidateBackup, type LifeOSBackupV2 } from './backup'
import { SYNTHETIC_MODULE_TASKS, SYNTHETIC_PROFILE, SYNTHETIC_SCHEDULE_ITEMS } from '../test/fixtures/routine'

const draft: StarterDraft = { name: 'Novo usuário', modules: [], starterHabit: 'blank', habitName: '', minimumVersion: '', waterGoalMl: 900 }
async function withDatabase(run: (db: LifeOSDatabase) => Promise<void>) {
  const db = new LifeOSDatabase(`lifeos-starter-test:${crypto.randomUUID()}`)
  try { await db.open(); await seedDatabaseIfNeeded(db); await run(db) } finally { await db.delete() }
}
describe('primeiro acesso e preservação de dados', () => {
  it('distribui perfil neutro e somente os três templates básicos', () => {
    expect(DEFAULT_SETTINGS.profile).toEqual({ displayName: '', hasCat: false })
    expect(DEFAULT_SETTINGS.enabledModules).toEqual([])
    expect(DEFAULT_HABITS.map(habit => habit.id)).toEqual([
      DEFAULT_IDS.habit.brushTeethMorning, DEFAULT_IDS.habit.registerSleep, DEFAULT_IDS.habit.water,
    ])
  })
  it('começa sem atividades, histórico ou perfil pessoal do autor', async () => withDatabase(async db => {
    const settings = await db.settings.get('lifeos-settings')
    expect(settings?.profile).toEqual({ displayName: '', hasCat: false })
    expect(settings?.onboarding?.completed).toBe(false)
    expect(await db.habits.count()).toBe(0)
    expect(await db.scheduleItems.count()).toBe(0)
    expect(await db.moduleTasks.count()).toBe(0)
    expect(await db.habitLogs.count()).toBe(0)
  }))
  it('conclui em branco e não impõe hábitos depois de reabrir', async () => withDatabase(async db => {
    await finishOnboarding(db, draft)
    await seedDatabaseIfNeeded(db)
    expect(await db.habits.count()).toBe(0)
    expect((await db.settings.get('lifeos-settings'))?.onboarding?.completed).toBe(true)
    await expect(finishOnboarding(db, draft)).rejects.toThrow(/concluída/)
  }))
  it('primeiro hábito começa hoje, sem XP e sem reescrever o passado', async () => withDatabase(async db => {
    await finishOnboarding(db, { ...draft, starterHabit: 'custom', habitName: 'Ler', minimumVersion: 'Uma página' }, new Date('2026-09-16T12:00:00Z'))
    const h = (await db.habits.toArray())[0]
    expect(h.name).toBe('Ler'); expect(h.startsOn).toBe('2026-09-16'); expect(h.currentXp).toBe(0)
    expect(h.planHistory?.[0].effectiveFrom).toBe('2026-09-16')
    expect(await db.habitLogs.count()).toBe(0)
  }))
  it('ativa o pacote completo, e água acompanha a inclusão e remoção de registros', async () => withDatabase(async db => {
    const now = new Date('2026-09-22T12:00:00Z')
    await finishOnboarding(db, { ...draft, modules: ['pets', 'home'], starterHabit: 'basic' }, now)
    const habits = await db.habits.toArray()
    expect(habits).toHaveLength(3)
    expect(habits.find(h => h.id === DEFAULT_IDS.habit.brushTeethMorning)?.category).toBe('hygiene')
    expect(await db.habitLogs.count()).toBe(0)
    await lifeOSDataOperations.addWater(db, '2026-09-22', 200, now)
    await lifeOSDataOperations.addWater(db, '2026-09-22', 100, now)
    expect((await db.habitLogs.toArray()).filter(l => l.habitId === DEFAULT_IDS.habit.water)).toHaveLength(1)
    expect((await db.habits.get(DEFAULT_IDS.habit.water))?.currentXp).toBe(0)
    const entries = await db.waterLogs.toArray()
    await lifeOSDataOperations.removeWater(db, entries[0].id, now)
    expect(await db.habitLogs.count()).toBe(1)
    await lifeOSDataOperations.removeWater(db, entries[1].id, now)
    expect(await db.habitLogs.count()).toBe(0)
    await expect(lifeOSDataOperations.setHabitLog(db, DEFAULT_IDS.habit.water, '2026-09-22', 'done', undefined, now)).rejects.toThrow(/quantidade/)
  }))
  it('falha de configuração não deixa conclusão parcial', async () => withDatabase(async db => {
    await expect(finishOnboarding(db, { ...draft, starterHabit: 'custom' })).rejects.toThrow()
    expect((await db.settings.get('lifeos-settings'))?.onboarding?.completed).toBe(false)
    expect(await db.habits.count()).toBe(0)
  }))
  it('preserva perfil, hábitos e planejamento de instalações antigas', async () => withDatabase(async db => {
    const settings = { ...structuredClone(DEFAULT_SETTINGS), profile: structuredClone(SYNTHETIC_PROFILE) }
    const retiredHabit = { ...structuredClone(DEFAULT_HABITS[0]), id: DEFAULT_IDS.habit.checkBackpack, name: 'Hábito legado de teste' }
    await db.settings.put(settings)
    await db.habits.put(retiredHabit)
    await db.scheduleItems.bulkPut(structuredClone([...SYNTHETIC_SCHEDULE_ITEMS]))
    await db.moduleTasks.bulkPut(structuredClone([...SYNTHETIC_MODULE_TASKS]))
    const planning = await db.scheduleItems.toArray()
    await db.meta.update('database-meta', { seedVersion: 3 })
    await seedDatabaseIfNeeded(db)
    expect(await db.settings.get('lifeos-settings')).toEqual(settings)
    expect(await db.habits.toArray()).toEqual([retiredHabit])
    expect(await db.scheduleItems.toArray()).toEqual(planning)
    expect(await db.moduleTasks.toArray()).toEqual(SYNTHETIC_MODULE_TASKS)
  }))
  it('categorias próprias sobrevivem ao backup e referências inválidas são rejeitadas', async () => withDatabase(async db => {
    await finishOnboarding(db, draft)
    await lifeOSDataOperations.updateSettings(db, { customCategories: [{ id:'custom:idiomas', name:'Idiomas', color:'blue', icon:'book', archived:false }] })
    const habit = { ...structuredClone(DEFAULT_HABITS[0]), category: 'custom:idiomas' as const }
    habit.planHistory = [{ effectiveFrom: habit.startsOn!, startsOn: habit.startsOn, frequency: habit.frequency, status: habit.status, phaseId: habit.phaseId }]
    const data: LifeOSBackupV2 = { format:'lifeos-backup', schemaVersion:2, exportedAt:new Date().toISOString(), data: { habits:[habit], habitLogs:[], sleepLogs:[], dayCheckIns:[], waterLogs:[], scheduleItems:[], moduleTasks:[], therapyNotes:[], settings:await db.settings.toArray(), meta:await db.meta.toArray() } }
    expect(normalizeAndValidateBackup(data).data.settings[0].customCategories?.[0].name).toBe('Idiomas')
    data.data.settings[0].customCategories = []
    expect(() => normalizeAndValidateBackup(data)).toThrow(/categoria inexistente/)
    await expect(lifeOSDataOperations.updateSettings(db, { customCategories:[{id:'custom:x', name:'', color:'blue', icon:'book', archived:false}] })).rejects.toThrow()
  }))
})
